"use client";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import React from "react";
import { Skeleton } from "../ui/skeleton";

const Navheader = () => {
//   const user = useQuery(api.user.getCurrentUser);
//   if (!user) return <Skeleton className="h-8 w-full" />;
//   if (user === undefined) {
//     return <Skeleton className="h-8 w-full" />;
//   }  implement this logic 
  return (
    <div className="w-full">
      <p className="text-xl font-bold">Hi ,you</p>
    </div>
  );
};

export default Navheader;