import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-bold">Know what to post. Get the enquiries. Collect the reviews.</h1>
      <Link href="/login" className="font-semibold text-primary underline">
        Start your 7-day free trial
      </Link>
    </main>
  );
}
