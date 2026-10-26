import type { Metadata } from "next";
import { FeedGame } from "@/components/game/FeedGame";

export const metadata: Metadata = {
  title: "Feed тоглоом",
  description: "12 пост гүйлгээд алгоритм таныг хэрхэн харсныг олж мэдээрэй.",
};

export default function GamePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 md:pt-20">
      <FeedGame />
    </div>
  );
}
