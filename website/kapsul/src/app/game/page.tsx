import type { Metadata } from "next";
import { FeedGame } from "@/components/game/FeedGame";
import { AppMode } from "@/components/ui/AppMode";

export const metadata: Metadata = {
  title: "Feed тоглоом",
  description: "12 пост гүйлгээд алгоритм таныг хэрхэн харсныг олж мэдээрэй.",
};

// Апп маягийн хуудас: header-ийн доорх дэлгэцийг бүтэн эзэлж, хуудас өөрөө гүйлгэгдэхгүй (AppMode, globals.css).
// Урт агуулга зүүн баганын дотор гүйлгэгдэнэ.
export default function GamePage() {
  return (
    <div className="flex h-[calc(100svh-4rem)] w-full flex-col overflow-hidden px-5 pt-4 pb-4 md:px-10 md:pt-14 md:pb-8 xl:px-16">
      <AppMode />
      <FeedGame />
    </div>
  );
}
