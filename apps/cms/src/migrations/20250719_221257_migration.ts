import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.connection.collection("globals").updateOne(
    { globalType: "common" },
    {
      $set: {
        uiLabels: {
          maintenanceScreen: {
            login: {
              de: "Anmelden",
              fr: "Connexion",
              es: "Iniciar sesión",
              en: "Login",
            },
          },
          banner: {
            dismiss: {
              de: "Schließen",
              fr: "Fermer",
              es: "Cerrar",
              en: "Dismiss",
            },
          },
          login: {
            email: {
              de: "E-Mail",
              fr: "Adresse électronique",
              es: "Correo electrónico",
              en: "Email",
            },
            password: {
              de: "Passwort",
              fr: "Mot de passe",
              es: "Contraseña",
              en: "Password",
            },
            submit: {
              de: "Anmelden",
              fr: "Se connecter",
              es: "Iniciar sesión",
              en: "Log In",
            },
          },
          imageViewer: {
            next: {
              de: "Nächstes",
              fr: "Suivant",
              es: "Siguiente",
              en: "Next",
            },
            seeMoreImages_one: {
              de: "+{{count}} Foto",
              fr: "+{{count}} photo",
              es: "+{{count}} foto",
              en: "+{{count}} Photo",
            },
            fullscreen: {
              de: "Vollbild",
              fr: "Plein écran",
              es: "Pantalla completa",
              en: "Full Screen",
            },
            close: {
              de: "Schließen",
              fr: "Fermer",
              es: "Cerrar",
              en: "Close",
            },
            seeMoreImages_other: {
              de: "+{{count}} Fotos",
              fr: "+{{count}} photos",
              es: "+{{count}} fotos",
              en: "+{{count}} Photos",
            },
            previous: {
              de: "Vorheriges",
              fr: "Précédent",
              es: "Anterior",
              en: "Previous",
            },
            exitFullscreen: {
              de: "Vollbild beenden",
              fr: "Quitter le plein écran",
              es: "Salir de pantalla completa",
              en: "Exit Full Screen",
            },
          },
          slidesBlock: {
            goToSlide: {
              de: "Gehe zu Folie {{slide}}",
              fr: "Aller à la diapositive {{slide}}",
              es: "Ir a la diapositiva {{slide}}",
              en: "Go to slide {{slide}}",
            },
          },
          errorBoundary: {
            text: {
              de: "<p>Hoppla! Etwas ist schief gelaufen.</p><p>Diese Seite funktioniert im Moment nicht richtig. Bitte versuchen Sie es erneut oder kommen Sie später zurück.</p><p>Vielen Dank für Ihr Verständnis!</p>",
              fr: "<p>Oups! Quelque chose s’est mal passé.</p><p>Cette page ne fonctionne pas correctement en ce moment. Veuillez essayer de rafraîchir ou revenir un peu plus tard.</p><p>Merci de votre compréhension!</p>",
              es: "<p>¡Vaya! Algo salió mal.</p><p>Esta página no está funcionando correctamente en este momento. Por favor, intente refrescar o vuelva un poco más tarde.</p><p>¡Gracias por su comprensión!</p>",
              en: "<p>Oops! Something went wrong.</p><p>This page isn’t working right now. Please try refreshing or come back a bit later.</p><p>Thank you for your understanding!</p>",
            },
            title: {
              de: "500 – Etwas ist schief gelaufen",
              fr: "500 – Quelque chose s’est mal passé",
              es: "500 – Algo salió mal",
              en: "500 – Something went wrong",
            },
          },
          footer: {
            heading: {
              de: "Fußzeile",
              fr: "Pied de page",
              es: "Pie de página",
              en: "Footer",
            },
            newsletter: {
              emailLabel: {
                de: "E-Mail",
                fr: "Adresse électronique",
                es: "Correo electrónico",
                en: "Email",
              },
            },
          },
        },
      },
    },
  );
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}
