import brandLogo from "@/assets/schoolmaster-logo.png.asset.json";

/** Platform-level SchoolMaster brand mark. NOT the per-school uploaded logo. */
export function BrandLogo({
  className = "h-12 w-12",
  rounded = "rounded-xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <img
      src={brandLogo.url}
      alt="SchoolMaster"
      width={512}
      height={512}
      className={`${className} ${rounded} object-contain`}
    />
  );
}
