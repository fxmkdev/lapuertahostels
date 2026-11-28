import type { Resource } from "i18next";

export const adminResources: Resource = {
  en: {
    admin: {
      livePreview: {
        brand: "Preview brand",
        scenario: "Preview scenario",
        notFound: "Page not found",
        serverError: "Server error",
        connection:
          "Could not connect to the CMS for live preview. Showing the last loaded content. Reopen live preview from the CMS.",
        authentication:
          "Live preview could not update. Showing the last loaded content. Check your CMS session and access, then reopen live preview.",
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
        brand: "Marca de vista previa",
        scenario: "Escenario de vista previa",
        notFound: "Página no encontrada",
        serverError: "Error del servidor",
        connection:
          "No se pudo conectar con el CMS para la vista previa en vivo. Se muestra el último contenido cargado. Abre de nuevo la vista previa en vivo desde el CMS.",
        authentication:
          "No se pudo actualizar la vista previa en vivo. Se muestra el último contenido cargado. Comprueba tu sesión y tus permisos en el CMS y abre de nuevo la vista previa en vivo.",
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
