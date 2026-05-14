import { apiRequest } from "@/lib/queryClient";
import type { Transaction } from "@shared/schema";

export const transactionService = {
  async getTransactions(): Promise<Transaction[]> {
    const res = await apiRequest("GET", "/api/transactions");
    return await res.json();
  },

  async createTransaction(input: {
    type: "deposit" | "withdrawal";
    amount: number;
    date: string;
    note?: string;
  }): Promise<Transaction> {
    const res = await apiRequest("POST", "/api/transactions", input);
    return await res.json();
  },

  async deleteTransaction(id: number): Promise<void> {
    await apiRequest("DELETE", `/api/transactions/${id}`, undefined, {
      headers: { "X-Confirm-Action": "delete-transaction" },
    });
  },
};
