import NextAuth from "next-auth";
import { authOptions } from "@/components/common/auth/server/authOptions";

export default NextAuth(authOptions);

