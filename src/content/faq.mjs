// The questions people ask, in order: the landing page shows the first ones, the FAQ page all of them.
// Answers are HTML; links go to the site's own pages.

export const FAQ = [
  {
    q: 'Is IPAForge free?',
    a: 'Yes. IPAForge is free and open source under the GNU AGPL-3.0, and a free Apple ID is enough to use it.'
  },
  {
    q: 'Do I need a paid Apple developer account?',
    a: "No. A free Apple ID works, within Apple's limits: 3 sideloaded apps at a time on each device, 7 days per signature and 10 App IDs a week. IPAForge shows each before it changes anything, and refreshes your apps before they expire. A paid account works too, without those limits."
  },
  {
    q: 'Why does macOS or Windows warn me when I open it?',
    a: 'IPAForge isn\'t notarised by Apple or code-signed for Windows yet. <a href="/install/#opening-ipaforge-the-first-time">Install</a> shows the one-time steps for each system. Both come with 1.0.'
  },
  {
    q: 'What do I need on Windows and Linux?',
    a: 'On Windows, install Apple Devices from the Microsoft Store, so your computer can talk to the iPhone. On Linux, install usbmuxd. macOS needs nothing extra.'
  },
  {
    q: 'Which iPhones and iPads work?',
    a: 'iOS 15 or later with a passcode. On iOS 16 and later, Developer Mode must be on; the checklist on the Devices page shows how.'
  },
  {
    q: 'Where does my Apple ID password go?',
    a: 'Only to Apple. If you choose to save it, it stays encrypted in your system keychain on your computer.'
  },
  {
    q: 'Does IPAForge update itself?',
    a: 'Yes. It checks for a new version when it opens, and installs it only after its release signature checks out. Copies installed from a .msi, .deb or .rpm say when a new version is out, and which file to download. <a href="/releases/">Release notes</a> list every version.'
  },
  {
    q: 'An install failed. What now?',
    a: 'Every error has a code and its fix right in the app. <a href="/troubleshooting/">Troubleshooting</a> lists every code. Still stuck? Ask on <a href="https://discord.gg/C87DKmAWhr">Discord</a>, or open an issue on GitHub with the logs attached (Logs › Save in the app).'
  },
  {
    q: 'Is IPAForge part of SideStore?',
    a: "No. IPAForge is an independent project that installs SideStore and works alongside it. It isn't affiliated with SideStore or Apple."
  }
]

/** How many questions the landing page shows before "All questions". */
export const FAQ_ON_HOME = 4
