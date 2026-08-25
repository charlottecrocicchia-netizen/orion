import { expect, test } from "@playwright/test";

/** R4 — PURCHASING POWER : le financement en dollars internationaux.
 *
 *  Le contrat recetté : le groupe n'apparaît QUE sur une vue cadrée sur
 *  une seule année d'attribution et sur une dimension au grain
 *  participation ; la grammaire s'écrit `value=ppp` nu, sans `base`,
 *  sans `cur` ; le sélecteur ne touche jamais au filtre temporel ; les
 *  refus se disent avec le bon motif, jamais un écran vide ; et les
 *  trois exclusions ne se confondent pas.
 *
 *  Graine : le couple est semé à la même vintage pour US (ratio 1,00),
 *  FR (1,30), DE (1,25), NL (1,20) et EU (1,30) sur 2021-2025 ;
 *  l'Italie ne l'a que sur 2022 et l'Espagne jamais — d'où deux motifs
 *  distincts sur la vue 2021. Aucune série en 2026. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("orion.lang", "en");
    window.localStorage.setItem("orion.theme", "light");
  });
});

test("le groupe n'existe que sur une année unique", async ({ page }) => {
  // Sans borne temporelle : la fenêtre ne résout pas une année.
  await page.goto("/explore?by=country");
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /View funding as/ }).click();
  await expect(page.getByText("Purchasing power", { exact: true })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");

  // Une fenêtre pluriannuelle : toujours pas.
  await page.goto("/explore?by=country&time=2021..2024");
  await page.getByRole("button", { name: /View funding as/ }).click();
  await expect(page.getByText("Purchasing power", { exact: true })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");

  // Une année unique ET publiée : le groupe apparaît.
  await page.goto("/explore?by=country&time=2023..2023");
  await page.getByRole("button", { name: /View funding as/ }).click();
  await expect(
    page.getByText("Purchasing power", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Compare purchasing power across countries"),
  ).toBeVisible();
});

test("une année sans référence n'est pas proposée du tout", async ({
  page,
}) => {
  // Défaut de recette (2026-08-25) : le sélecteur offrait le mode sur
  // 2026, dont aucune juridiction ne publie la référence — le clic menait
  // droit à un refus. Le contrôle n'offre que ce que la vue peut
  // honorer, et la liste des années vient du serveur.
  await page.goto("/explore?by=country&time=2026..2026&split=0");
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /View funding as/ }).click();
  await expect(page.getByText("Purchasing power", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("radio", { name: /PPP-adjusted/ })).toHaveCount(
    0,
  );
  // Les autres modes ne bougent pas : c'est le pouvoir d'achat qui manque
  // de référence, pas la vue qui serait cassée.
  await expect(page.getByText("Value", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Real value/ })).toBeVisible();
});

test("la bascule écrit value=ppp nu et ne touche pas au filtre temporel", async ({
  page,
}) => {
  await page.goto("/explore?by=country&time=2023..2023");
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /View funding as/ }).click();
  await page.getByRole("radio", { name: /PPP-adjusted/ }).click();

  await expect(page).toHaveURL(/value=ppp/);
  // La canonicalisation passe par une réécriture d'URL : on laisse le
  // temps à l'effet, puis on vérifie l'absence.
  await expect(page).not.toHaveURL(/base=/, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/cur=/, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/perspective=/, { timeout: 15_000 });
  // L'année reste celle que l'utilisateur a cadrée — le mode ne la
  // déplace jamais.
  await expect(page).toHaveURL(/time=2023\.\.2023/);
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toContainText("PPP-adjusted");
});

test("la note ⓘ dit le sens, sa limite, les flux et la convention de change", async ({
  page,
}) => {
  await page.goto("/explore?by=country&time=2023..2023&value=ppp");
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.getByText(/ⓘ Reference/).click();

  await expect(
    page.getByText(/general price level of the recipient country/),
  ).toBeVisible();
  // La limite, immédiatement après le sens — jamais reléguée.
  await expect(
    page.getByText(/does not measure the specific cost of researchers/),
  ).toBeVisible();
  // Le caractère spatial, avec l'année cadrée.
  await expect(
    page.getByText(/within a single award year \(2023\)/),
  ).toBeVisible();
  // L'avertissement de la source sur les flux.
  await expect(page.getByText(/not financial flows/)).toBeVisible();
  // La convention de change du dénominateur.
  await expect(
    page.getByText(/not on the rate any recipient actually obtained/),
  ).toBeVisible();
  // L'instantané est nommé pour ce qu'il est : un import Orion.
  await expect(page.getByText(/Orion reference snapshot/)).toBeVisible();
});

test("les motifs d'exclusion ne se confondent pas", async ({ page }) => {
  // 2021 : l'Espagne n'a jamais le couple, l'Italie l'a en 2022 — deux
  // phrases différentes, sur la même vue.
  await page.goto("/explore?by=country&time=2021..2021&value=ppp");
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.getByText(/ⓘ Reference/).click();
  await expect(
    page.getByText(/no published series for this territory/),
  ).toBeVisible();
  await expect(
    page.getByText(/reference not yet published for 2021/),
  ).toBeVisible();
  // Et le contexte : l'année la plus récente se remplit progressivement.
  await expect(
    page.getByText(/publishes the most recent year progressively/),
  ).toBeVisible();
});

test("une année sans référence refuse la vue, sans écran vide", async ({
  page,
}) => {
  await page.goto("/explore?by=country&time=2026..2026&value=ppp");
  await expect(page.getByText(/not available for 2026/)).toBeVisible({
    timeout: 15_000,
  });
  // La sortie est un geste : le retour au nominal est proposé.
  await page.getByRole("button", { name: "Nominal" }).click();
  await expect(page).not.toHaveURL(/value=ppp/);
});

test("une vue pluriannuelle forcée par l'URL se refuse en toutes lettres", async ({
  page,
}) => {
  await page.goto("/explore?by=country&time=2021..2024&value=ppp");
  await expect(page.getByText(/Select a single year/)).toBeVisible({
    timeout: 15_000,
  });
});

test("le mode survit au rechargement", async ({ page }) => {
  await page.goto("/explore?by=country&time=2023..2023&value=ppp");
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toContainText("PPP-adjusted", { timeout: 15_000 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: /View funding as/ }),
  ).toContainText("PPP-adjusted", { timeout: 15_000 });
  await expect(page).toHaveURL(/value=ppp/);
});

test("FR : le mode se dit en français, sans un mot d'anglais", async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("orion.lang", "fr"),
  );
  await page.goto("/explore?by=country&time=2023..2023");
  await expect(page.getByRole("button", { name: /Lire en/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Lire en/ }).click();
  await expect(
    page.getByText("Pouvoir d'achat", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Parité de pouvoir d'achat/ }).click();
  await expect(page).toHaveURL(/value=ppp/);
  await page.keyboard.press("Escape");
  await page.getByText(/ⓘ Référentiel/).click();
  await expect(
    page.getByText(/niveau général des prix du pays bénéficiaire/),
  ).toBeVisible();
  await expect(page.getByText(/pas des flux financiers/)).toBeVisible();
});

test("verrou : l'échantillon des séries est identique nominal ↔ PPP", async ({
  page,
}) => {
  // Le mode change comment on regarde, jamais QUI. `split` étant
  // interdit en PPP, le verrou se lit sur la vue à année unique.
  await page.addInitScript(() => {
    URL.createObjectURL = (blob: Blob) => {
      void blob.text().then((text) => {
        (window as unknown as { __csv?: string }).__csv = text;
      });
      return "blob:capture";
    };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
  });

  const seriesSet = async (query: string) => {
    await page.goto(`/explore?${query}`);
    await expect(
      page.getByRole("button", { name: /View funding as/ }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "CSV", exact: true }).click();
    await page.waitForFunction(
      () => (window as unknown as { __csv?: string }).__csv,
    );
    const csv = await page.evaluate(() => {
      const w = window as unknown as { __csv?: string };
      const value = w.__csv;
      w.__csv = undefined;
      return value ?? "";
    });
    return new Set(
      csv
        .split("\n")
        .slice(2)
        .map((line) => line.split(",")[0])
        // Les lignes « # » portent l'unité et l'attribution : elles
        // changent AVEC le mode, c'est leur rôle. L'échantillon, lui,
        // ne bouge pas.
        .filter((cell) => cell && !cell.startsWith("#")),
    );
  };

  const base = "by=country&time=2021..2021";
  const nominal = await seriesSet(base);
  expect(nominal.size).toBeGreaterThan(1);
  expect(await seriesSet(`${base}&value=ppp`)).toEqual(nominal);
});
