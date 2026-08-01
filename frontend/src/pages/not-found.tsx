import { Link } from "react-router";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center px-6 pt-24 text-center">
      <p className="display-tight hero-gradient text-[64px] font-semibold leading-none">404</p>
      <h1 className="mt-4 text-xl font-medium">{t("notFound.title")}</h1>
      <Link to="/" className="mt-6 text-accent underline-offset-2 hover:underline">
        {t("notFound.back")}
      </Link>
    </div>
  );
}
