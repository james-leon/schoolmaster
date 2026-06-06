import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { WINTEK_CONTACT } from "@/lib/plans";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — SchoolMaster" },
      { name: "description", content: "Politique de confidentialité et protection des données personnelles, conforme à la loi camerounaise n°2024/017." },
    ],
  }),
  component: PrivacyPage,
});

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

  const backTo = !isAuthenticated || !user
    ? "/login"
    : user.role === "parent"
    ? "/parent"
    : user.role === "super_admin"
    ? "/super-admin"
    : "/dashboard";

  const backLabel = !isAuthenticated || !user ? "Retour" : "Retour à l'accueil";

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <Link to={backTo} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {backLabel}
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Logo compact />
          </div>
        </div>
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dernière mise à jour : juin 2026 — Conforme à la loi camerounaise n°2024/017 sur la protection des données à caractère personnel.
                </p>
              </div>
            </div>

            <Section title="1. Quelles données sont collectées">
              <p>SchoolMaster collecte uniquement les données nécessaires à la gestion scolaire :</p>
              <ul className="ml-5 list-disc space-y-1">
                <li><strong>Élèves</strong> : nom, prénom, date de naissance, sexe, photo, classe, code élève, statut.</li>
                <li><strong>Parents / tuteurs</strong> : nom, téléphone, email, WhatsApp, relation avec l'élève.</li>
                <li><strong>Enseignants et personnel</strong> : nom, email, téléphone, matières enseignées.</li>
                <li><strong>Données scolaires</strong> : notes, présences, paiements, emploi du temps, communications.</li>
              </ul>
            </Section>

            <Section title="2. Pourquoi ces données sont collectées">
              <p>
                Ces données sont utilisées exclusivement pour la gestion administrative et pédagogique de l'établissement
                scolaire : inscription des élèves, suivi des notes et des présences, gestion des paiements de scolarité,
                communication avec les parents, et établissement des bulletins et reçus.
              </p>
            </Section>

            <Section title="3. Qui y a accès">
              <ul className="ml-5 list-disc space-y-1">
                <li><strong>L'école</strong> (responsable du traitement) : administrateur, enseignants et personnel autorisé, selon leur rôle.</li>
                <li><strong>Les parents</strong> : accès uniquement aux données de leurs propres enfants.</li>
                <li><strong>Wintek</strong> (prestataire technique) : assistance technique uniquement, sur autorisation explicite de l'école.</li>
              </ul>
              <p>Aucune donnée n'est revendue ni partagée avec des tiers à des fins commerciales.</p>
            </Section>

            <Section title="4. Comment elles sont protégées">
              <ul className="ml-5 list-disc space-y-1">
                <li>Stockage sécurisé sur une infrastructure professionnelle avec chiffrement en transit (HTTPS) et au repos.</li>
                <li>Isolation stricte des données par école — aucune école ne peut voir les données d'une autre.</li>
                <li>Accès restreint par rôle (Row Level Security) — un enseignant ne voit pas les finances, un parent ne voit que son enfant.</li>
                <li>Authentification sécurisée et journalisation des connexions.</li>
                <li>Sauvegardes régulières.</li>
              </ul>
            </Section>

            <Section title="5. Vos droits">
              <p>Conformément à la loi n°2024/017, vous disposez des droits suivants :</p>
              <ul className="ml-5 list-disc space-y-1">
                <li><strong>Droit d'accès</strong> : obtenir une copie des données vous concernant ou concernant votre enfant.</li>
                <li><strong>Droit de rectification</strong> : faire corriger des données inexactes.</li>
                <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données (sauf obligations légales de conservation).</li>
                <li><strong>Droit d'opposition</strong> : vous opposer à certains traitements.</li>
              </ul>
            </Section>

            <Section title="6. Propriété des données">
              <p>
                Les données scolaires appartiennent à l'école. Wintek agit uniquement en tant que prestataire technique
                hébergeant la plateforme. L'école peut à tout moment exporter ou supprimer ses données.
              </p>
            </Section>

            <Section title="7. Conformité légale">
              <p>
                SchoolMaster est conçu pour être conforme à la loi camerounaise n°2024/017 du 23 décembre 2024 relative
                à la protection des données à caractère personnel, applicable à compter du 23 juin 2026.
              </p>
            </Section>

            <Section title="8. Contact">
              <p>Pour exercer vos droits ou toute question sur le traitement de vos données :</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>Contactez d'abord <strong>votre école</strong> (responsable du traitement).</li>
                <li>Pour les questions techniques : <strong>{WINTEK_CONTACT.email}</strong> — {WINTEK_CONTACT.phone}</li>
              </ul>
            </Section>

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
