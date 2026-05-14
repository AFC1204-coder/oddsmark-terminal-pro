export function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/embed/") ||
    pathname === "/verify" ||
    pathname.startsWith("/verify?") ||
    pathname.startsWith("/tipster/") ||
    pathname === "/privacidad" ||
    pathname === "/condiciones" ||
    pathname === "/juego-responsable" ||
    pathname === "/soporte" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/responsible-gaming" ||
    pathname === "/support" ||
    pathname === "/ranking"
  );
}
