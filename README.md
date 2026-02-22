# maude

A browser extension for modding web pages and web apps.

Allows defining injection rules called "maudes". Each maude consists a URL matcher and a script to inject.

## Creating a maude:

1. Press the '+' button at the top right of the maude list.
1. The default matcher is the full URL of your current tab. You can generalise as follows, depending on the matcher mode:
    1. In 'wildcard' mode, you can replace any single character with a '?' and any sequence of characters with a '*'.
    1. In 'regex' mode, you can use any JavaScript regular expression.
1. Select the script you want to inject into the page using one of the following:
    1. Upload a file from your computer.
    1. Retrieve a file from a URL (WARNING: only use this option with trusted sources).
    1. Paste the JavaScript code into the Maude editor.
1. The 'Injection timing' section provides the following options:
    1. Specifying a delay in seconds.
    1. Specifying an injection condition. The selected script will only be injected once the condition returns true.
        1. If a delay has also been specified, the condition will be checked repeatedly, starting after the first delay, and repeating the same delay between checks.
        1. If a delay has not been specified, the condition will only be checked once, after the page's initial loading has completed.

## Editing a maude:

Press the pencil icon next to any existing maude to:

1. Rename it.
1. Edit its matcher.
1. Edit or replace the script. Note that if you uploaded a file from your computer, you will need to replace it with the new version each time you edit the file.
1. Update the timing options.

Press the bin icon next to any existing maude to delete it (a confirmation will be shown first).

## Publishing and importing maudes

To **import** a maude from a URL: click **Import** in the side panel, enter the `maude.json` URL, then **Load**. You can review and edit the maude before saving.

To **publish** a maude for others, share the following file(s):

1. **maude.json** - JSON with `name`, `matches` (single URL pattern), and either `js-url` (script filename or URL) or `js-raw` (inline JavaScript string). Optional: `matcherMode` ("wildcard" or "regex"), `delaySeconds`, `injectionCondition`.
2. Your **script file** (if using `js-url`) - the JavaScript to inject.

See the [example in docs/examples](https://github.com/privman/maude/tree/main/docs/examples/copy-gcal-event-link) (maude.json + script).

Note: If the manifest is at `https://yoursite.com/maude/maude.json` and you use `js-url` with `my-script.js`, Maude fetches the script from `https://yoursite.com/maude/my-script.js`.

Full details: [docs](https://privman.github.io/maude/#managing-maudes).

