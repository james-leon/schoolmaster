import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SetupChecklist } from "@/components/SetupChecklist";
import { useAuth } from "@/lib/auth";
import { isAdmin, isSchoolAdmin } from "@/lib/permissions";
import { WINTEK_CONTACT } from "@/lib/plans";
import { LifeBuoy, Mail, Phone, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/aide")({
  head: () => ({
    meta: [
      { title: "Aide & premiers pas — SchoolMaster" },
      { name: "description", content: "Guide de démarrage rapide et assistance pour utiliser SchoolMaster : configuration de l'école, classes, notes, paiements." },
      { property: "og:title", content: "Aide & premiers pas — SchoolMaster" },
      { property: "og:description", content: "Guide de démarrage rapide et assistance pour utiliser SchoolMaster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AidePage,
});

/** Which "first steps" sections a role may see. */
function sectionsFor(role?: string): string[] {
  switch (role) {
    case "school_admin":
    case "super_admin":
      return ["admin", "accountant"];
    case "teacher":
      return ["teacher"];
    case "parent":
      return ["parent"];
    case "secretary":
      return ["secretary"];
    default:
      return [];
  }
}

function AidePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const sections = sectionsFor(user?.role);
  const showChecklist = isAdmin(user) || isSchoolAdmin(user);

  return (
    <AppLayout title={t("help.title")}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-['Sora'] text-2xl font-bold tracking-tight text-foreground">
            {t("help.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("help.subtitle")}</p>
        </div>
      </div>

      {showChecklist && (
        <div className="mt-6 space-y-2">
          <SetupChecklist variant="help" />
          <p className="text-xs text-muted-foreground">{t("setup.reopenHint")}</p>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {sections.map((key) => {
          const items = t(`help.roles.${key}.items`, { returnObjects: true }) as unknown;
          const list = Array.isArray(items) ? (items as string[]) : [];
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">
                  {t("help.firstStepsTitle")} — {t(`help.roles.${key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {list.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="font-['Sora'] text-base font-semibold text-foreground">
            {t("help.contactTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("help.contactText")}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <Phone className="h-4 w-4 text-primary" />
              <span>
                <span className="text-muted-foreground">{t("help.phoneLabel")}: </span>
                {WINTEK_CONTACT.phones}
              </span>
            </span>
            <span className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4 text-primary" />
              <a className="hover:underline" href={`mailto:${WINTEK_CONTACT.email}`}>
                {WINTEK_CONTACT.email}
              </a>
            </span>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
