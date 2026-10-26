import { Landing } from "@/components/marketing/landing";
import { DEFAULT_TRADE } from "@/lib/config/trades";

export default function Home() {
  return <Landing trade={DEFAULT_TRADE} />;
}
