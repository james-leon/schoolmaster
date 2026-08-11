import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { WINTEK_CONTACT } from "@/lib/plans";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — SchoolMaster" },
      { name: "description", content: "Politique de confidentialité et protection des données personnelles, conforme à la loi camerounaise n°2024/017." },
    ],
  }),
  component: PrivacyPage,
});

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  afterBullets?: string[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();

  const backTo = !isAuthenticated || !user
    ? "/login"
    : user.role === "parent"
    ? "/parent"
    : user.role === "super_admin"
    ? "/super-admin"
    : "/dashboard";

  const backLabel = !isAuthenticated || !user ? t("legal.back") : t("legal.backHome");
  const title = t("legal.privacy.title");
  const updated = t("legal.privacy.updated");
  const sections = t("legal.privacy.sections", { returnObjects: true }) as LegalSection[];

  const fillContact = (text: string) =>
    text.replace("{{email}}", WINTEK_CONTACT.email).replace("{{phones}}", WINTEK_CONTACT.phones);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <Link to={backTo} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {backLabel}
          </Link>
          <BrandLogo className="h-9 w-9" rounded="rounded-lg" />
        </div>
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{updated}</p>
              </div>
            </div>

            {sections.map((section, idx) => (
              <Section key={idx} title={section.title}>
                {section.paragraphs?.map((p, pIdx) => (
                  <p key={pIdx}>{fillContact(p)}</p>
                ))}
                {section.bullets && (
                  <ul className="ml-5 list-disc space-y-1">
                    {section.bullets.map((b, bIdx) => (
                      <li key={bIdx}>{fillContact(b)}</li>
                    ))}
                  </ul>
                )}
                {section.afterBullets?.map((p, pIdx) => (
                  <p key={`after-${pIdx}`}>{fillContact(p)}</p>
                ))}
              </Section>
            ))}

            <div className="border-t pt-4">
              <Button asChild variant="outline">
                <Link to={backTo}><ArrowLeft className="mr-1.5 h-4 w-4" /> {backLabel}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
