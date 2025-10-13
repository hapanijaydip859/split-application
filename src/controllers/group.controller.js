import Group from "../models/Group.js";
import User from "../models/User.js";
import crypto from "crypto";

export const createGroup = async (req, res, next) => {
  try {
    const { name, currency, category, icon } = req.body;

    if (!name?.trim()) { return res.status(402).json({ message: "Group name is required" }) }

    const creator = await User.findById(req.user._id);
    if (!creator) { return res.status(402).json({ message: "User not found" }) }

    const resolvedCurrency = currency || creator.defaultCurrency || "INR";
    const inviteToken = crypto.randomBytes(10).toString("hex");

    const group = await Group.create({
      name: name.trim(),
      currency: resolvedCurrency,
      category: category || "Other",
      icon: icon || null,
      members: [{ user: req.user._id, role: "admin" }],
      createdBy: req.user._id,
      inviteToken,
    });

    res.status(201).json({
      success: true,
      message: "Group created successfully",
      data: group,
    });
  } catch (error) {
    console.error("❌ createGroup Error:", error.message);

    res.status(500).json({
      message: "Failed to create group",
      error: error.message,
    });
  }
};

export const addMember = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { userId, email } = req.body;

    const group = await Group.findById(groupId);
    if (!group) { return res.status(402).json({ message: "Group not found" }) };

    // only admin can add members
    const isAdmin = group.members.some(
      (m) => String(m.user) === String(req.user._id) && m.role === "admin"
    );
    if (!isAdmin) { return res.status(402).json({ message: "Only admin can add members" }) }

    let userToAdd;
    if (userId) {
      userToAdd = await User.findById(userId);
    } else if (email) {
      userToAdd = await User.findOne({ email });
    }

    if (!userToAdd) { return res.status(402).json({ message: "User not found" }) }

    // check if already member
    const alreadyMember = group.members.some(
      (m) => String(m.user) === String(userToAdd._id)
    );
    if (alreadyMember) { return res.status(402).json({ message: "User already a member" }) };

    group.members.push({ user: userToAdd._id, role: "member" });
    await group.save();

    res.status(200).json({
      success: true,
      message: "Member added successfully",
      data: group,
    });
  } catch (error) {
    console.error("❌ addMember Error:", error.message);
    res.status(500).json({
      message: "Add member failed",
      error: error.message,
    });

  }
};

// --------------------------------------------
//  B2: Get Invite Link
// --------------------------------------------
export const getInviteLink = async (req, res) => {
  try {
    const { id } = req.params; // groupId
    const { email } = req.query; // optional invite email
    const userId = req.user._id; // ✅ from JWT middleware (requireAuth)

    // 1️⃣ Validate group existence
    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2️⃣ Verify that requester is an existing member of this group
    const isMember = group.members.some(
      (m) => String(m.user) === String(userId)
    );

    if (!isMember) {
      return res.status(403).json({
        message:
          "Access denied. Only existing group members can generate an invite link.",
      });
    }

    // 3️⃣ (Optional) Check if the user wants to invite someone via email
    let inviteLink = `${process.env.BACKEND_URL}/join/${id}`;
    if (email) {

      inviteLink += `?email=${email}`;
    }

    // 4️⃣ Send success response
    res.status(200).json({
      message: "Invite link created successfully",
      data: {
        _id: group._id,
        name: group.name,
        inviteLink,
      },
    });
  } catch (error) {
    console.error("❌ getInviteLink Error:", error.message);
    res.status(500).json({
      message: "Failed to generate invite link",
      error: error.message,
    });
  }
};


// --------------------------------------------
//  B2: Join Group via Link
// --------------------------------------------
export const joinGroupByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const group = await Group.findOne({ inviteToken: token });
    if (!group) { return res.status(402).json({ message: "Invalid invite link" }) }

    // check already member
    const alreadyMember = group.members.some(
      (m) => String(m.user) === String(req.user._id)
    );
    if (alreadyMember) {
      return res.status(200).json({
        success: true,
        message: "Already joined this group",
      });
    }

    group.members.push({ user: req.user._id, role: "member" });
    await group.save();

    res.json({
      success: true,
      message: "Joined group successfully",
      data: group,
    });
  } catch (error) {
    console.error("❌ joinGroupByToken Error:", error.message);
    res.status(500).json({
      message: "Failed to join group",
      error: error.message,
    });
  }
};
export const getAllGroups = async (req, res) => {
  try {
    // 1️⃣ Find all groups where logged-in user is a member
    const groups = await Group.find({ "members.user": req.user._id })
      .select("_id name icon") // ✅ only these fields
      .sort({ createdAt: -1 });

    // 2️⃣ Handle empty result
    if (!groups || groups.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No groups found for this user",
        data: [],
      });
    }

    // 3️⃣ Success response
    res.status(200).json({
      success: true,
      message: "Groups fetched successfully",
      data: groups,
    });
  } catch (error) {
    console.error("❌ getAllGroups Error:", error.message);
    res.status(500).json({
      message: "Failed to fetch groups",
      error: error.message,
    });
  }
};
// 🔹 Get single group by ID
export const getGroupById = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id; // ✅ use logged-in user's ID

    const group = await Group.findById(groupId)
      .populate("members.user", "name email")
      .lean();

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // ✅ Check if this logged-in user is a member of the group
    const isMember = group.members.some(
      (m) => String(m.user._id) === String(userId)
    );

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    res.status(200).json({
      success: true,
      message: "Group fetched successfully",
      data: group,
    });
  } catch (error) {
    console.error("❌ getGroupById Error:", error.message);
    res.status(500).json({
      message: "Failed to fetch group",
      error: error.message,
    });
  }
};


export const joingroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.query;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.render("popup", {
        title: "❌ Group Not Found",
        message: "This group does not exist or has been deleted.",
        icon: "❌",
        status: "error",
      });
    }

    if (!email) {
      return res.render("popup", {
        title: "⚠️ Invalid Link",
        message: "Email is required to join the group.",
        icon: "⚠️",
        status: "warning",
      });
    }

    const invitedUser = await User.findOne({ email });
    if (!invitedUser) {
      return res.render("popup", {
        title: " User Not Found",
        message: "No user found with this email. Please sign up first.",
        icon: "❌",
        status: "error",
      });
    }

    const alreadyMember = group.members.some(
      (m) => String(m.user) === String(invitedUser._id)
    );
    if (alreadyMember) {
      return res.render("popup", {
        title: " Already a Member",
        message: `You're already part of the group "${group.name}".`,
        icon: "⚠️",
        status: "warning",
      });
    }

    group.members.push({ user: invitedUser._id, role: "member" });
    await group.save();

    return res.render("popup", {
      title: " Joined Successfully",
      message: `You've been added to the group "${group.name}" successfully.`,
      icon: "✅",
      status: "success",
    });
  } catch (error) {
    console.error("❌ joingroup Error:", error.message);
    return res.render("popup", {
      title: " Error",
      message: "Something went wrong while joining the group.",
      icon: "❌",
      status: "error",
    });
  }
};

//leaveGroup
// export const leaveGroup = async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const userId = req.user._id;

//     const group = await Group.findById(groupId);
//     if (!group) {
//       return res.status(404).json({ message: "Group not found" });
//     }

//     // check if user is a member
//     const isMember = group.members.some(
//       (m) => String(m.user) === String(userId)
//     ); 
//     console.log("answer==>" , isMember);

//     if (!isMember) {
//       return res
//         .status(403)
//         .json({ message: "You are not a member of this group" });
//     }

//     // remove user from group
//     group.members = group.members.filter(
//       (m) => String(m.user) !== String(userId)
//     );
//     await group.save();

//     res.status(200).json({
//       message: "Member left the group successfully",
//       remainingMembers: group.members.length,
//     });
//   } catch (error) {
//     console.error("❌ leaveGroup Error:", error.message);
//     res.status(500).json({
//       message: "Failed to leave group",
//       error: error.message,
//     });
//   }
// };
export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // 1️⃣ Find group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2️⃣ Check if user exists in group
    const member = group.members.find(
      (m) => String(m.user) === String(userId)
    );
    if (!member) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // 3️⃣ Prevent admin from leaving
    if (member.role === "admin") {
      return res.status(403).json({
        message: "Admin cannot leave the group. Please assign a new admin before leaving.",
      });
    }

    // 4️⃣ Allow normal member to leave
    group.members = group.members.filter(
      (m) => String(m.user) !== String(userId)
    );
    await group.save();

    res.status(200).json({
      message: "Member left the group successfully",
      remainingMembers: group.members.length,
    });
  } catch (error) {
    console.error("❌ leaveGroup Error:", error.message);
    res.status(500).json({
      message: "Failed to leave group",
      error: error.message,
    });
  }
};


//             2.admin remove member
export const removeMember = async (req, res) => {
  try {
    console.log("fff");

    const { groupId, memberId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // check if requester is admin
    const requester = group.members.find(
      (m) => String(m.user) === String(userId)
    );
    if (!requester || requester.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can remove members" });
    }

    // check target exists
    const target = group.members.find(
      (m) => String(m.user) === String(memberId)
    );
    if (!target) {
      return res
        .status(404)
        .json({ message: "Target member not found in this group" });
    }

    // admin cannot remove themselves
    if (String(memberId) === String(userId)) {
      return res.status(400).json({
        message: "Admin cannot remove themselves with this API",
      });
    }

    // remove member
    group.members = group.members.filter(
      (m) => String(m.user) !== String(memberId)
    );
    await group.save();

    res.status(200).json({
      message: "Member removed successfully",
      removedUserId: memberId,
    });
  } catch (error) {
    console.error("❌ removeMember Error:", error.message);
    res.status(500).json({
      message: "Failed to remove member",
      error: error.message,
    });
  }
};
// adimn - Leave - Group
export const adminLeaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId).populate("members.user", "name email");
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const admin = group.members.find(
      (m) => String(m.user._id) === String(userId)
    );
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Only admin can use this API" });
    }

    // remove admin
    group.members = group.members.filter(
      (m) => String(m.user._id) !== String(userId)
    );

    // if group has no members → delete
    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      return res.status(200).json({
        message: "Admin left, group deleted because no members remain",
      });
    }

    // promote first member to admin
    group.members[0].role = "admin";
    await group.save();

    res.status(200).json({
      message: "Admin left, new admin assigned",
      newAdmin: {
        userId: group.members[0].user._id,
        name: group.members[0].user.name,
        email: group.members[0].user.email,
      },
    });
  } catch (error) {
    console.error("❌ adminLeaveGroup Error:", error.message);
    res.status(500).json({
      message: "Failed to process admin leave",
      error: error.message,
    });
  }
};
// field is update 
export const updateGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    const { name, icon, category } = req.body;

    // 1️⃣ Find group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2️⃣ Check if requester is a member
    const requester = group.members.find(
      (m) => String(m.user) === String(userId)
    );
    if (!requester) {
      return res.status(403).json({
        message: "Only group members can update group details",
      });
    }

    // 3️⃣ Update allowed fields only (if provided)
    if (name) group.name = name;
    if (icon) group.icon = icon;
    if (category) group.category = category;

    await group.save();

    // 4️⃣ Respond success
    res.status(200).json({
      message: "Group details updated successfully",
      data: {
        _id: group._id,
        name: group.name,
        icon: group.icon,
        category: group.category,
        updatedBy: requester.role, // optional info
      },
    });
  } catch (error) {
    console.error("❌ updateGroupDetails Error:", error.message);
    res.status(500).json({
      message: "Failed to update group details",
      error: error.message,
    });
  }
};


export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // 1️⃣ Find group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2️⃣ Verify user is admin
    const requester = group.members.find(
      (m) => String(m.user) === String(userId)
    );
    if (!requester || requester.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can delete this group" });
    }

    // 3️⃣ Delete group
    await Group.findByIdAndDelete(groupId);

    res.status(200).json({
      message: "Group deleted successfully",
      deletedGroupId: groupId,
    });
  } catch (error) {
    console.error("❌ deleteGroup Error:", error.message);
    res.status(500).json({
      message: "Failed to delete group",
      error: error.message,
    });
  }
};





