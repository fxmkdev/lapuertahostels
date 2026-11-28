import { initReactI18next } from "react-i18next";
import i18n from "i18next";
import i18nextConfig from "../app/i18n";

i18n
  .use(initReactI18next)
  .init({
    ...i18nextConfig,
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    partialBundledLanguages: false, // no backend in Storybook, UI label translations are mocked below
  })
  .then(() => {
    // Mock UI label translations for Storybook
    i18n.addResourceBundle("en", "ui-labels", {
      maintenanceScreen: {
        login: "Login",
      },
      banner: {
        dismiss: "Dismiss",
      },
      login: {
        email: "Email",
        password: "Password",
        submit: "Log In",
      },
      imageViewer: {
        next: "Next",
        seeMoreImages_one: "+{{count}} Photo",
        fullscreen: "Full Screen",
        close: "Close",
        seeMoreImages_other: "+{{count}} Photos",
        previous: "Previous",
        exitFullscreen: "Exit Full Screen",
      },
      mapBlock: { locations: "Locations" },
      slidesBlock: {
        goToSlide: "Go to slide {{slide}}",
      },
      errorBoundary: {
        text: "<p>Oops! Something went wrong.</p><p>This page isn’t working right now. Please try refreshing or come back a bit later.</p><p>Thank you for your understanding!</p>",
        title: "500 – Something went wrong",
      },
      footer: {
        heading: "Footer",
        newsletter: {
          emailLabel: "Email",
        },
      },
    });
  });

export default i18n;
