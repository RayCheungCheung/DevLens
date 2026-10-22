# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens হলো ওয়ার্কফ্লো-কেন্দ্রিক একটি ডেভেলপার ব্রাউজার।

এটি একই URL একসাথে মোবাইল ও ডেস্কটপ ফ্রেমে দেখায় এবং রিয়েল-টাইম কনসোল/নেটওয়ার্ক, HTTP ইন্টারসেপ্টর ও রিপিটার, লাইভ ডিজাইন সম্পাদনা, রিকন রিপোর্ট, AI সহকারী এবং সরাসরি এডিটরে পাঠানোর সুবিধা দেয়।

## মূল ফিচার

- ট্যাব বার, নেভিগেশন বার ও সাইডবারে immersive workspace থিম।
- দুটি viewport-এর প্রিভিউ এবং স্ক্রল সিঙ্ক।
- নাম, রঙ, ড্র্যাগ, কনটেক্সট মেনু ও ফোল্ডিং সহ Tab Groups।
- Split View দুটি বিদ্যমান ট্যাব রিলোড না করে পাশাপাশি দেখায়।
- content protection ও threat overlay সহ WImH সুরক্ষা।
- অন্তর্ভুক্ত DevTools: Elements, Console, Network ও Application।
- ইতিহাস, বুকমার্ক, ট্রাফিক ও সাজেশনসহ স্মার্ট Omnibox।
- আলাদা Electron partition-এর মাধ্যমে workspace ও profile আইসোলেশন।

## টেকনোলজি স্ট্যাক

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## শুরু করুন

`outputs/devlens` ফোল্ডার থেকে নিচের কমান্ডগুলো চালান:

| স্ক্রিপ্ট | বিবরণ |
| --- | --- |
| `npm install` | নির্ভরতা ইনস্টল করুন |
| `npm run dev` | HMR সহ Vite ও Electron চালু করুন |
| `npm run build` | টাইপ যাচাই করে out/ বিল্ড করুন |
| `npm run start` | বিল্ড করা অ্যাপ চালান |
| `npm run typecheck` | tsc --noEmit চালান |

## কীবোর্ড শর্টকাট

| কাজ | শর্টকাট |
| --- | --- |
| নতুন ট্যাব | `Ctrl+T` |
| ট্যাব বন্ধ করুন | `Ctrl+W` |
| পেজ রিলোড | `Ctrl+R` |
| পেজে খুঁজুন | `Ctrl+F` |
| সেটিংস খুলুন | `Ctrl+,` |
| নতুন প্রাইভেট ট্যাব | `Ctrl+Shift+P` |
| Shell DevTools | `F12` |
| Elements প্যানেল | `Ctrl+Shift+I` |
| Console প্যানেল | `Ctrl+Shift+J` |
| Network প্যানেল | `Ctrl+Shift+E` |
| সাইডবার | `Ctrl+Shift+B` |
| Ghost মোড | `Ctrl+Shift+G` |
| WImH সুরক্ষা | `Ctrl+Shift+H` |
| সর্বশেষ ট্যাব | `Ctrl+Tab` |

## লাইসেন্স

প্রকল্পটি [MIT লাইসেন্স](../../LICENSE) অনুযায়ী প্রকাশিত।

## অবদান

Issue ও pull request স্বাগতম। পরিবর্তন পাঠানোর আগে `npm run typecheck` চালান।

