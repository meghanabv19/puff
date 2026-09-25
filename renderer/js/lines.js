// Everything Puff can say, grouped by situation. Short, cute, lowercase.
// Edit freely — this is the one file to touch for wording. Keep the group
// names stable; the rest of the app looks them up by these keys.

export const LINES = {
  // {name} is filled in occasionally by the bubble (see bubble.js). Lines that
  // include it will sometimes use your name and sometimes drop it gracefully.
  greeting: [
    'hi{name}! double-click me for the focus panel',
    'hello again{name} ♡',
    "i'm here whenever you need me{name}",
  ],
  hover: ['hehe hi!', 'you found me~', 'boop?', 'working hard?', '(=^･ω･^=)'],
  click: ['hehe', 'that tickles!', "you're doing great{name}", 'ʕ•ᴥ•ʔ ♡', 'hi{name}!'],
  pet: ['purrrr~', "mmm that's nice", 'more pats pls', '♡ ♡ ♡'],
  dragStart: ['wheee!', 'where are we going?!', 'aaa!'],
  wake: ['oh! welcome back{name}', '*yawn* hi again', 'i missed you{name}'],

  focusStart: ["let's do this together{name}!", 'focus mode, activated ✦', "i'll keep you company"],
  breakStart: ['break time, stretch with me!', 'rest those eyes a sec', 'little pause ♡'],
  focusCheer: ["you've got this{name}!", 'focus buddies ✦', 'one thing at a time', 'so proud of you', 'keep going, almost there'],
  focusDone: ['you did it{name}!! take a little break', 'session done ✦ nice work', 'that was a good one'],
  breakDone: ['ready for another round?', 'back to it when you are', 'i saved your spot'],

  taskAdded: ["got it, i'll cheer you on", 'added! ♡', 'one step at a time'],
  taskDone: ['yay! one down!', 'look at you go{name}!', 'task squashed ✦', 'so satisfying~'],

  distract: ['back to it{name}? ♡', 'psst… that focus session ✦', 'i believe in you, one more push', 'come back to me~ 🥺'],

  // Puff gets angry when a social site opens
  angry: ['hey! no social media 😤', 'back to work{name}! >:(', 'i saw that! 👀', 'nuh uh, not now~', 'focus focus focus 😤', 'put that down{name} 😾'],

  // break-time playfulness
  breakDance: ['🎵 dance with me!', 'wiggle wiggle~', 'break dance party ♡', 'shake it off{name}!'],
  breakCoffee: ['coffee time ☕', 'lil caffeine break~', 'i made you a coffee ♡', 'sip sip{name}'],
  breakMeditate: ['breathe in… and out…', 'ommm 🧘', "let's be calm together", 'soften your shoulders~'],
  breakNap: ['power nap? 😴', 'quick rest with me~', 'zzz… just five minutes', 'recharge time{name}'],
  breakAsk: ['want a lil dance? 🎵', 'coffee break? ☕', 'shall we stretch together?', 'meditate for a sec? 🧘', 'nap with me{name}? 😴'],

  // ambient playfulness through the day
  idlePlay: ['la la la~', 'just vibing ♡', '🎵', 'wheee', 'boop!', 'da da da dum~', '(๑•̀ㅂ•́)و'],

  // "seeing what you're doing" — gentle app-aware asides
  watchCoding: ['ooh, coding? ✨', 'look at you go, dev {name}', 'i love watching you build ♡', 'clean code, i bet 👀'],
  watchBrowser: ['whatcha reading? 👀', 'ooh, interesting~', 'i see you browsing hehe'],
  watchTerminal: ['hacker mode 😎', 'type type type~', 'the terminal wizard ✨'],

  water: ['sip of water? 💧', 'hydration check!', 'drink some water with me'],
  stretch: ['little stretch? 🙆', 'roll those shoulders~', 'stand up and wiggle with me'],
  eyes: ['look far away for a sec 👀', '20-20-20, rest your eyes', 'peek out the window?'],
  lateNight: ["it's getting late... sleep soon?", 'past bedtime~ wind down?', "i'll still be here tomorrow ♡"],

  streak: {
    3: ['3 days in a row! ✦', 'a little streak ♡'],
    7: ['a whole week!! so proud', '7-day streak ✦✦'],
    14: ['two weeks! unstoppable', 'fortnight of focus ✦'],
    30: ['THIRTY days. legend ♡', 'a month straight!!'],
  },
};
