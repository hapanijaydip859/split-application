import  z  from "zod";

/* ---------------- Base (Full) Settlement Schema ---------------- */
export const settlementSchema = z.object({
  groupId: z.string({
    required_error: "groupId is required"
  }),
  from: z.string({
    required_error: "from (payer) is required"
  }),
  to: z.string({
    required_error: "to (receiver) is required"
  }),
  amount: z.number({
    required_error: "amount is required"
  }).positive("Amount must be positive"),
  note: z.string().optional(),
});

/* ---------------- Split Settlement Schema ---------------- */
export const splitSettlementSchema = z.object({
  groupId: z.string({
    required_error: "groupId is required"
  }),

  to: z.string({
    required_error: "Receiver user ID (to) is required"
  }),

  amount: z.number({
    required_error: "Amount is required"
  }).positive("Amount must be greater than zero"),

  note: z.string().optional(),
});
