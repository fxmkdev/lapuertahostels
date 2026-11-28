import type { Resource } from "i18next";

export const adminResources: Resource = {
  en: {
    admin: {
      livePreview: {
        authentication:
          "Live preview could not update. Showing the last loaded content. Sign back into the CMS and reopen live preview.",
        request:
          "Live preview could not update. Showing the last loaded content. Try editing again or reload the preview.",
      },
      previewBar: {
        message:
          "<strong>Preview</strong> ‧ This website is currently in maintenance mode and not accessible publicly.",
        manageContent: "Manage Content…",
        logOut: "Log Out",
        versionInfo: "Version: {{ version }}",
      },
    },
  },
  es: {
    admin: {
      livePreview: {
        authentication:
          "No se pudo actualizar la vista previa en vivo. Se muestra el último contenido cargado. Vuelve a iniciar sesión en el CMS y abre de nuevo la vista previa en vivo.",
        request:
          "No se pudo actualizar la vista previa en vivo. Se muestra el último contenido cargado. Intenta editar de nuevo o recarga la vista previa.",
      },
      previewBar: {
        message:
          "<strong>Vista previa</strong> ‧ Este sitio web se encuentra actualmente en modo de mantenimiento y no es accesible públicamente.",
        manageContent: "Administrar contenido…",
        logOut: "Cerrar sesión",
        versionInfo: "Versión: {{ version }}",
      },
    },
  },
};
