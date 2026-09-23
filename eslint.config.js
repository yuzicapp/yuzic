// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const touchableNeedsLabel = require('./eslint-rules/touchable-needs-label');

/** Rules that are this app's own conventions rather than anyone's preset. */
const yuzic = { rules: { 'touchable-needs-label': touchableNeedsLabel } };

/**
 * Sizes, corner radii and spacing come from `constants/design`, everywhere.
 *
 * The app had 236 literal font sizes against 21 uses of the type tokens, 117
 * literal corner radii and 663 literal paddings — a design system that existed
 * and that almost nothing called. All of them are migrated; this keeps them that
 * way. The scale file itself is exempt, since that is where the numbers live.
 */
const SCALED_FILES = ["src/**/*.{ts,tsx}"];

const literalStyleValue = (property, token) => ({
  // Any literal, not just a numeric one: esquery cannot regex-match a number,
  // and a stringly-typed size is no better than a bare one.
  selector: `Property[key.name='${property}'][value.type='Literal']`,
  message: `Use a ${token} token from @/constants/design instead of a literal ${property}. Adding a role there is fine; a one-off number is how the scale drifts.`,
});

/** Zero is the absence of spacing rather than an amount of it, so it stays a
 * literal — `padding: 0` is clearer than any token could be. */
const literalSpacing = (property) => ({
  selector: `Property[key.name='${property}'][value.type='Literal'][value.value!=0]`,
  message: `Use a spacing token from @/constants/design instead of a literal ${property}. Adding a step there is fine; a one-off number is how the scale drifts.`,
});

/**
 * The same number, one branch deep.
 *
 * `[value.type='Literal']` only ever saw `paddingBottom: 140`. Four detail
 * screens kept `paddingBottom: Platform.OS === 'android' ? 180 : 140` right
 * through the sweep that introduced `spacing.scrollClearance`, because a
 * ConditionalExpression is not a Literal. Only a branch that is itself a raw
 * literal is flagged, so `cond ? spacing.md : spacing.lg` stays legal.
 */
const conditionalLiteralValue = (property, token) => ({
  selector: `Property[key.name='${property}'] > ConditionalExpression:matches([consequent.type='Literal'][consequent.value!=0], [alternate.type='Literal'][alternate.value!=0])`,
  message: `Use a ${token} token from @/constants/design on both branches instead of a literal ${property}. A number behind a Platform check is still a one-off number.`,
});

const SPACING_PROPERTIES = ['padding', 'margin'].flatMap(base => [
  base,
  ...['Horizontal', 'Vertical', 'Top', 'Bottom', 'Left', 'Right', 'Start', 'End']
    .map(side => base + side),
]);

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // Manual mocks are loaded by jest, which provides `jest` as a global there.
  {
    files: ["__mocks__/**/*.js"],
    languageOptions: { globals: { jest: "readonly" } },
  },
  // `jest.mock` has to be written before the imports it replaces are read by a
  // human, even though babel hoists it: the mock is the setup of the test.
  // import/first counted every such file — 39 warnings saying nothing.
  // A `jest.mock` factory is hoisted above every import, so a module it needs
  // can only be reached with `require` inside it — the one place the rule
  // against `require` has nothing better to offer.
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "import/first": "off", "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: SCALED_FILES,
    // The scale file is where the numbers live, and its test has to write a
    // fixture scale to check the scaling with.
    ignores: ["src/constants/design.ts", "src/constants/colors.ts", "src/constants/typography.ts", "src/constants/design.test.ts", "src/features/theme/presets.ts", "src/features/theme/color.ts", "src/features/theme/coverAccent.ts", "**/*.test.ts", "**/*.test.tsx"],
    plugins: { yuzic },
    rules: {
      "no-restricted-syntax": [
        "error",
        literalStyleValue("fontSize", "typography"),
        literalStyleValue("borderRadius", "radius"),
        ...SPACING_PROPERTIES.map(literalSpacing),
        conditionalLiteralValue("fontSize", "typography"),
        conditionalLiteralValue("borderRadius", "radius"),
        ...SPACING_PROPERTIES.map(p => conditionalLiteralValue(p, "spacing")),
        { selector: "Property[key.name=/^(gap|rowGap|columnGap)$/][value.type='Literal'][value.value!=0]", message: "Use a spacing token from @/constants/design instead of a literal gap." },
        { selector: "CallExpression[callee.name='withTiming'] Property[key.name='duration'][value.type='Literal'][value.value!=0]", message: "Use a motion token from @/constants/design instead of a literal animation duration." },
        { selector: "CallExpression[callee.property.name='setOptions'] Property[key.name='duration'][value.type='Literal'][value.value!=0]", message: "Use a motion token from @/constants/design instead of a literal animation duration." },
        { selector: "Property[key.name='shadowOpacity'][value.type='Literal'][value.value!=0]", message: "Use a shadow/stateLayer token from @/constants/design instead of a literal shadowOpacity." },
        { selector: "Property[key.name='elevation'][value.type='Literal'][value.value!=0]", message: "Use a shadow token from @/constants/design instead of a literal elevation." },
        { selector: "Property[key.name=/^(color|backgroundColor|borderColor|shadowColor|tintColor|placeholderTextColor)$/][value.type='Literal'][value.value=/^#/]", message: "Use a semantic color token from @/constants/design or useTheme instead of a raw hex color." },
        // A colour spelled out anywhere, not only as a style property. The rule
        // above it could only ever see `{ color: '#fff' }`: an `rgba(...)` was
        // invisible because it tests for a leading `#`, and a colour handed
        // straight to a JSX prop or sitting in a gradient's array is invisible
        // because it is not a Property at all. Forty-seven had collected in
        // twelve files, four of them the same faint white card.
        {
          selector: "Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?[(])/]",
          message:
            "Use a colour token from @/constants/design (onDark, veil, shade, onDarkAlpha, coverFade) or useTheme instead of spelling a colour out.",
        },
        // `colors.themeColor + '26'` is a hex alpha appended to a string, which
        // is neither a literal colour nor a token and so was caught by nothing.
        // Three sites, two alphas, one idea.
        {
          selector: "BinaryExpression[operator='+'] > Literal[value=/^[0-9a-fA-F]{2}$/][raw=/^['\"]/]",
          message:
            "Use tinted(color, strength) from @/constants/design instead of appending a hex alpha to a colour.",
        },
        // The glyph scale, which lives on a JSX attribute rather than a style
        // property — so none of the selectors above could ever have seen it,
        // and it drifted to 20 distinct values across 294 icons.
        {
          selector: "JSXAttribute[name.name='size'] > JSXExpressionContainer > Literal",
          message:
            "Use an iconSize token from @/constants/design instead of a literal size. Adding a role there is fine; a one-off number is how the scale drifts.",
        },
        // `components/Touchable` is the app's one answer to a press. A second
        // one drifts back the moment it is importable — a `TouchableOpacity`
        // had already reappeared in the server settings after the sweep that
        // removed every other use of it.
        {
          selector:
            "ImportDeclaration[source.value='react-native'] > ImportSpecifier[imported.name='TouchableOpacity']",
          message:
            "Use components/Touchable instead of TouchableOpacity. It gives Android a bounded ripple and every other platform an opacity dip, from one file so the two can't drift apart per screen.",
        },
      ],
      // A bare glyph says nothing to a screen reader unless it is told to.
      "yuzic/touchable-needs-label": "error",
    },
  },
]);
