/**
 * test/unit/wallet.test.ts — wallet pass pure logic
 *
 * No database, no network, no provider. These two functions sit on the boundary
 * between our data and a third-party API, which is exactly where a wrong answer
 * is expensive:
 *
 *  - walletColorPreset() must NEVER return a value the provider rejects, because
 *    the provider answers an unknown preset with a 400 and the customer's pass
 *    simply never gets issued. It must therefore be total: any input at all
 *    (null, garbage, a name instead of a hex) has to yield a valid preset.
 *  - isAllowedGoogleSaveUrl() gates a redirect we perform, so a false positive is
 *    an open redirect and a false negative breaks installation on Android. Both
 *    directions are asserted.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { walletColorPreset, WALLET_COLOR_PRESETS } from "../../src/palette/index.ts";
import { isAllowedGoogleSaveUrl } from "../../src/wallet/index.ts";

test("walletColorPreset always returns a preset the provider accepts", () => {
  const inputs = [
    undefined,
    null,
    "",
    "not a colour",
    "#12345",
    "#gggggg",
    "#14243a",
    "#FFFFFF",
    "#000000",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#808080",
    "  #14243A  ",
  ];

  for (const input of inputs) {
    const preset = walletColorPreset(input as unknown);
    assert.ok(
      (WALLET_COLOR_PRESETS as readonly string[]).includes(preset),
      `walletColorPreset(${JSON.stringify(input)}) returned "${preset}", which is not a valid preset`,
    );
  }
});

test("walletColorPreset maps brand hues to the nearest preset", () => {
  // The platform's own navy is near-black, and on a pass a near-black face reads
  // as intentional while a muddy dark blue does not.
  assert.equal(walletColorPreset("#14243a"), "dark");
  assert.equal(walletColorPreset("#1d3557"), "blue");
  assert.equal(walletColorPreset("#15803d"), "green");
  assert.equal(walletColorPreset("#c0392b"), "red");
  assert.equal(walletColorPreset("#c2410c"), "orange");
  assert.equal(walletColorPreset("#7e22ce"), "purple");
  assert.equal(walletColorPreset("#ffffff"), "dark"); // achromatic
  assert.equal(walletColorPreset("#000000"), "dark");
});

test("walletColorPreset is case- and whitespace-insensitive, and falls back to navy", () => {
  assert.equal(walletColorPreset("  #15803D  "), walletColorPreset("#15803d"));
  assert.equal(walletColorPreset(null), walletColorPreset("#14243a"));
  assert.equal(walletColorPreset("nonsense"), walletColorPreset("#14243a"));
});

test("isAllowedGoogleSaveUrl accepts only Google's own HTTPS save hosts", () => {
  assert.equal(isAllowedGoogleSaveUrl("https://pay.google.com/gp/v/save/abc.def"), true);
  assert.equal(isAllowedGoogleSaveUrl("https://wallet.google.com/gp/v/save/abc"), true);
});

test("isAllowedGoogleSaveUrl rejects every redirect that is not that", () => {
  // Plain HTTP is refused: a save link over http is either a mistake or a
  // downgrade, and the customer would be sent there by our own redirect.
  assert.equal(isAllowedGoogleSaveUrl("http://pay.google.com/gp/v/save/abc"), false);
  // Suffix and prefix look-alikes are the classic bypasses.
  assert.equal(isAllowedGoogleSaveUrl("https://pay.google.com.evil.example/save"), false);
  assert.equal(isAllowedGoogleSaveUrl("https://evil.example/pay.google.com"), false);
  assert.equal(isAllowedGoogleSaveUrl("https://evil.example/gp/v/save"), false);
  // Non-URL schemes must never be redirect targets.
  assert.equal(isAllowedGoogleSaveUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedGoogleSaveUrl("///pay.google.com"), false);
  // Absent or wrong-typed values (the pass simply has no Google link yet).
  assert.equal(isAllowedGoogleSaveUrl(null), false);
  assert.equal(isAllowedGoogleSaveUrl(undefined), false);
  assert.equal(isAllowedGoogleSaveUrl(""), false);
  assert.equal(isAllowedGoogleSaveUrl(42), false);
});
