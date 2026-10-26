import type { Metadata } from "next";
import { FeedGame } from "@/components/game/FeedGame";

export const metadata: Metadata = {
  title: "Feed тоглоом",
  description: "12 пост гүйлгээд алгоритм чамайг хэрхэн харсныг, пост бүр яагаад чамд хүрснийг олж мэд.",
};

export default function GamePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 md:pt-20">
      <FeedGame />
    </div>
  );
}
