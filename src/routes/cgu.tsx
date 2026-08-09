import * as React from "react";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { createFileRoute } from "@tanstack/react-router";
import { WINTEK_CONTACT } from "@/lib/plans";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions Générales d'Utilisation — SchoolMaster" },
      { name: "description", content: "Conditions générales d'utilisation du service SchoolMaster, édité par Wintek." },
    ],
  }),
  component: CguPage,
});

const updateDate = "juillet 2026";

function CguPage() {
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
                    Conditions Générales d'Utilisation
                  </h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Dernière mise à jour : {updateDate}
                  </p>
                </div>
              </div>
            </header>

            <article className="prose prose-sm max-w-none text-foreground">
              <Section title="1. OBJET">
                <p>
                  Les présentes Conditions Générales d'Utilisation (ci-après "CGU") ont pour objet de définir les modalités et conditions d'utilisation de l'application SchoolMaster (ci-après le "Service"), éditée par Wintek (Winner Technology), entreprise basée à Douala, Cameroun (ci-après "Wintek" ou "l'Éditeur").
                </p>
                <p>Toute utilisation du Service implique l'acceptation pleine et entière des présentes CGU par l'utilisateur.</p>
              </Section>

              <Section title="2. DÉFINITIONS">
                <ul className="list-disc space-y-1.5 pl-5">
                  <li><strong>"Service"</strong> : l'application SchoolMaster, accessible via navigateur web et application mobile.</li>
                  <li><strong>"École cliente"</strong> : l'établissement scolaire ayant souscrit au Service.</li>
                  <li><strong>"Utilisateur"</strong> : toute personne accédant au Service, incluant les administrateurs d'école, enseignants, et parents/tuteurs.</li>
                  <li><strong>"Compte"</strong> : l'espace personnel d'un Utilisateur sur le Service.</li>
                  <li><strong>"Données"</strong> : toute information saisie, stockée ou traitée via le Service, incluant les données personnelles des élèves, parents, et personnel de l'École cliente.</li>
                </ul>
              </Section>

              <Section title="3. ACCÈS AU SERVICE ET COMPTES UTILISATEURS">
                <p>
                  <strong>3.1.</strong> Le Service est accessible aux Utilisateurs disposant d'un compte créé par l'École cliente ou par l'Éditeur.
                </p>
                <p>
                  <strong>3.2.</strong> Le Service définit plusieurs rôles d'utilisateurs aux droits d'accès distincts : administrateur d'école, enseignant, parent/tuteur. Chaque rôle dispose de droits d'accès limités aux fonctionnalités et données nécessaires à son usage.
                </p>
                <p>
                  <strong>3.3.</strong> Chaque Utilisateur est responsable de la confidentialité de ses identifiants de connexion. Toute action effectuée depuis un compte est réputée effectuée par le titulaire de ce compte.
                </p>
                <p>
                  <strong>3.4.</strong> L'Utilisateur s'engage à changer son mot de passe temporaire dès sa première connexion et à ne le communiquer à aucun tiers.
                </p>
              </Section>

              <Section title="4. OBLIGATIONS DE L'UTILISATEUR">
                <p>L'Utilisateur s'engage à :</p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>Fournir des informations exactes lors de la création de son compte ;</li>
                  <li>Utiliser le Service conformément à sa destination (gestion scolaire) ;</li>
                  <li>Ne pas accéder ou tenter d'accéder à des données ne relevant pas de son rôle ;</li>
                  <li>Ne pas perturber le fonctionnement du Service (intrusion, surcharge, extraction non autorisée de données) ;</li>
                  <li>Respecter la confidentialité des données des élèves et des autres Utilisateurs.</li>
                </ul>
              </Section>

              <Section title="5. PROTECTION DES DONNÉES PERSONNELLES">
                <p>
                  <strong>5.1.</strong> Le Service traite des données personnelles, incluant des données concernant des mineurs (élèves). Ce traitement est effectué conformément à la loi camerounaise n°2024/017 relative à la protection des données à caractère personnel.
                </p>
                <p>
                  <strong>5.2.</strong> Les données des élèves sont traitées sous la responsabilité de l'École cliente, qui agit en tant que responsable de traitement. Wintek agit en tant que sous-traitant technique, hébergeant et sécurisant les Données pour le compte de l'École cliente.
                </p>
                <p>
                  <strong>5.3.</strong> Le traitement des données d'un élève mineur requiert le consentement préalable de son parent ou tuteur légal, recueilli par l'École cliente selon les modalités prévues à cet effet.
                </p>
                <p>
                  <strong>5.4.</strong> Les Utilisateurs disposent d'un droit d'accès, de rectification et de suppression de leurs données personnelles, à exercer auprès de l'École cliente ou de l'Éditeur.
                </p>
                <p>
                  <strong>5.5.</strong> Pour plus de détails, se référer à la{" "}
                  <Link to="/confidentialite" className="text-primary underline underline-offset-4 hover:text-primary/80">
                    Politique de Confidentialité
                  </Link>{" "}
                  du Service.
                </p>
              </Section>

              <Section title="6. PROPRIÉTÉ INTELLECTUELLE">
                <p>
                  <strong>6.1.</strong> Le Service, son code source, son design, sa marque et l'ensemble des éléments qui le composent sont la propriété exclusive de Wintek et sont protégés par les droits de propriété intellectuelle applicables.
                </p>
                <p>
                  <strong>6.2.</strong> Les Données saisies par l'École cliente (informations sur les élèves, notes, documents, etc.) demeurent la propriété de l'École cliente. Wintek ne revendique aucun droit de propriété sur ces Données.
                </p>
              </Section>

              <Section title="7. DISPONIBILITÉ DU SERVICE ET RESPONSABILITÉ">
                <p>
                  <strong>7.1.</strong> Wintek s'efforce d'assurer une disponibilité continue du Service, sans garantie de disponibilité absolue. Des interruptions peuvent survenir pour maintenance, mise à jour, ou en cas de force majeure.
                </p>
                <p>
                  <strong>7.2.</strong> Wintek ne saurait être tenu responsable des dommages indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le Service.
                </p>
                <p>
                  <strong>7.3.</strong> La responsabilité de l'exactitude des Données saisies (notes, informations élèves, paiements) incombe à l'École cliente et aux Utilisateurs les ayant saisies.
                </p>
              </Section>

              <Section title="8. ABONNEMENT ET PAIEMENT">
                <p>
                  Les modalités d'abonnement, de tarification et de paiement font l'objet d'un contrat de service distinct conclu entre Wintek et l'École cliente.
                </p>
              </Section>

              <Section title="9. SUSPENSION ET RÉSILIATION">
                <p>
                  <strong>9.1.</strong> Wintek se réserve le droit de suspendre ou résilier l'accès d'un Utilisateur en cas de violation des présentes CGU.
                </p>
                <p>
                  <strong>9.2.</strong> En cas de résiliation du contrat de service par l'École cliente, l'accès au Service est désactivé selon les modalités prévues au contrat, et les Données peuvent être exportées par l'École cliente préalablement à leur suppression.
                </p>
              </Section>

              <Section title="10. MODIFICATION DES CGU">
                <p>
                  Wintek se réserve le droit de modifier les présentes CGU à tout moment. Les Utilisateurs seront informés de toute modification substantielle. La poursuite de l'utilisation du Service après modification vaut acceptation des nouvelles CGU.
                </p>
              </Section>

              <Section title="11. DROIT APPLICABLE ET JURIDICTION">
                <p>
                  Les présentes CGU sont soumises au droit camerounais. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence exclusive des tribunaux compétents de Douala, Cameroun.
                </p>
              </Section>

              <Section title="12. CONTACT">
                <p>
                  Pour toute question relative aux présentes CGU, l'Utilisateur peut contacter Wintek (Winner Technology) à Douala, Cameroun.
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Email : {WINTEK_CONTACT.email}</li>
                  <li>Téléphone : {WINTEK_CONTACT.phones}</li>
                </ul>
              </Section>
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
