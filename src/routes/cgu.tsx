import * as React from "react";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { createFileRoute } from "@tanstack/react-router";
import { WINTEK_CONTACT } from "@/lib/plans";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions Générales d'Utilisation — SchoolMaster" },
      { name: "description", content: "Conditions générales d'utilisation du service SchoolMaster, édité par Wintek." },
    ],
  }),
  component: CguPage,
});

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  afterBullets?: string[];
};

function CguPage() {
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
  const title = t("legal.cgu.title");
  const updated = t("legal.cgu.updated");
  const sections = t("legal.cgu.sections", { returnObjects: true }) as LegalSection[];

  const fillContact = (text: string) =>
    text.replace("{{email}}", WINTEK_CONTACT.email).replace("{{phones}}", WINTEK_CONTACT.phones);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            to={backTo}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {backLabel}
          </Link>
          <BrandLogo className="h-9 w-9" rounded="rounded-lg" />
        </div>

        <Card className="overflow-hidden print:border-0 print:shadow-none">
          <CardContent className="p-6 sm:p-8 lg:p-10">
            <header className="mb-8 border-b border-border pb-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {title}
                  </h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">{updated}</p>
                </div>
              </div>
            </header>

            <article className="prose prose-sm max-w-none text-foreground">
              {sections.map((section, idx) => {
                const isDataProtectionSection = section.title.includes("5.") || /PROTECTION DES DONNÉES|PROTECTION OF PERSONAL DATA/i.test(section.title);
                return (
                  <Section key={idx} title={section.title}>
                    {section.paragraphs?.map((p, pIdx) => {
                      const isPrivacyLinkParagraph = isDataProtectionSection && /Politique de Confidentialité|Privacy Policy/i.test(p);
                      if (isPrivacyLinkParagraph) {
                        const [before, after] = p.split(/Politique de Confidentialité|Privacy Policy/i);
                        const linkLabel = /Politique de Confidentialité/i.test(p) ? "Politique de Confidentialité" : "Privacy Policy";
                        return (
                          <p key={pIdx}>
                            {before}
                            <Link to="/confidentialite" className="text-primary underline underline-offset-4 hover:text-primary/80">
                              {linkLabel}
                            </Link>
                            {after}
                          </p>
                        );
                      }
                      return <p key={pIdx}>{fillContact(p)}</p>;
                    })}
                    {section.bullets && (
                      <ul className="list-disc space-y-1.5 pl-5">
                        {section.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{fillContact(b)}</li>
                        ))}
                      </ul>
                    )}
                  </Section>
                );
              })}
            </article>

            <div className="mt-8 border-t border-border pt-6 print:hidden">
              <Button asChild variant="outline">
                <Link to={backTo}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> {backLabel}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h2 className="font-display mb-2.5 text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
