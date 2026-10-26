import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { qrSvg } from "@/lib/qr";
import { reviewLinkFor } from "@/lib/reviews";
import { appUrl } from "@/lib/utils";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Print QR" };

// Printable poster (A4/Letter) or a sheet of business cards. The app chrome
// is hidden with print CSS.
export default async function PrintPage(props: PageProps<"/business/[id]/reviews/print">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { business } = await requireBusiness(id);
  const link = reviewLinkFor(business);
  const pageUrl = appUrl(`/b/${business.slug}`);
  const [reviewQr, pageQr] = await Promise.all([link ? qrSvg(link.url) : Promise.resolve(null), qrSvg(pageUrl)]);
  const type = sp.type === "card" ? "card" : "poster";

  if (type === "poster") {
    return (
      <div className="flex flex-col items-center gap-4">
        <PrintButton />
        <div className="flex w-full max-w-[18cm] flex-col items-center gap-6 rounded-2xl border-2 border-foreground bg-white p-10 text-center text-black print:border-0">
          <p className="text-4xl font-bold">Enjoyed your visit?</p>
          <p className="text-xl">We&apos;d love an honest review. Scan to leave one.</p>
          {reviewQr ? (
            <div className="h-72 w-72" dangerouslySetInnerHTML={{ __html: reviewQr }} />
          ) : (
            <p className="text-sm">Add your review link in Booked to print this poster.</p>
          )}
          <p className="text-2xl font-semibold">{business.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <PrintButton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex h-[5.5cm] w-[9cm] items-center gap-3 rounded-lg border border-black bg-white p-3 text-black">
            <div className="h-[4cm] w-[4cm] shrink-0" dangerouslySetInnerHTML={{ __html: reviewQr ?? pageQr }} />
            <div className="flex flex-col gap-1">
              <p className="font-bold leading-tight">{business.name}</p>
              <p className="text-xs">{reviewQr ? "Scan to leave an honest review. Thank you!" : "Scan to see our services and get in touch."}</p>
              {business.phone && <p className="text-xs">{business.phone}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
