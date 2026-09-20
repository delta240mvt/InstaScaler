# ManyChat + Instagram: current paid capabilities

Research date: 2026-08-03. Sources below are owned by ManyChat or Meta. This is a capability comparison note, not a claim that every feature is available through Instagram's API in every account configuration.

## What the paid product offers

ManyChat's current paid ladder is **Essential from $14/month** and **Pro from $29/month** on annual billing. Essential includes unlimited custom automations, contact-data collection, and tags. Pro adds broadcasts, AI-powered conversations, custom inbox labels/rules, and more connected channels. Pricing is by monthly *Active Contacts*; a person counts once in a month if they send or receive a ManyChat message, including through an automation, broadcast, AI, or Inbox. [ManyChat pricing](https://manychat.com/pricing)

## Instagram comment and DM flows

- A post/reel comment automation can target a specific post/reel, any post/reel, or the next post/reel; it can match listed words or any comment. The quick follower-growth automation follows this order: opening DM, optional email collection, follow request, main link DM, optional follow-up. [ManyChat: Grow followers from comments](https://help.manychat.com/hc/en-us/articles/20310878273692-Quick-Automation-Grow-followers-from-comments)
- The opening DM is designed to get an interaction first; once the person taps its button, ManyChat says it may send additional messages in the next 24 hours. That interaction requirement is an important platform constraint, not merely a UX preference. [Same source](https://help.manychat.com/hc/en-us/articles/20310878273692-Quick-Automation-Grow-followers-from-comments)
- In the general Flow Builder, message blocks can send text, images, and buttons. Actions can tag a contact, subscribe them to a sequence, notify an admin, or open a conversation. A condition routes based on criteria, a randomizer can split up to six variants with adjustable percentages, and a Smart Delay schedules a later step. [ManyChat: build an automation](https://help.manychat.com/hc/en-us/articles/14281166306332-How-to-build-a-Manychat-automation)

## Buttons and decision points

- Instagram text messages support up to **three buttons**; button names must be under 20 characters. Button actions can open a website, move to a step, run actions, branch on a condition, randomize, delay, or start another automation. [ManyChat: Buttons](https://help.manychat.com/hc/en-us/articles/14281157003292-Buttons)
- The first private reply after an Instagram Live comment is deliberately restricted: one content block only (text or image, with buttons/quick replies), no user input, DM lists, typing delay, dynamic blocks, or next steps. The user must interact with the private reply to open the 24-hour messaging window. This shows the platform boundary that an InstaScaler flow must respect as well. [ManyChat: Instagram Live Comments Trigger](https://help.manychat.com/hc/en-us/articles/14281275933724-Instagram-Live-Comments-Trigger)

## Sequences, tags, rules and growth triggers

- ManyChat uses tags plus conditions to segment people; its paid Rules feature can react to tags, dates, conversion events, sequence subscription status and custom/system-field changes. Rules may trigger a sequence or another automation. [ManyChat: rules](https://help.manychat.com/hc/en-us/articles/14281170185628-How-to-set-custom-rules-with-Triggers-Conditions-and-Actions)
- A rule is limited to once per contact per 30 seconds, and bulk actions deliberately do not fire rules. [Same source](https://help.manychat.com/hc/en-us/articles/14281170185628-How-to-set-custom-rules-with-Triggers-Conditions-and-Actions)
- The Instagram product area lists triggers beyond comments: story reply, story mention, ads, live comments, share-to-DM, ref-URL, conversation starters and main menu. [ManyChat Instagram automation index](https://help.manychat.com/hc/en-us/sections/13556929073308-Instagram)

## Product implications for InstaScaler

ManyChat's paid differentiators are chiefly visual flow composition, segmentation/contact state, delayed sequences, broadcast/AI, and many entry points. InstaScaler already has the strongest part of the comment-to-DM path: direct webhook handling, follow gate, deduplication, direct links and delivery logs. The best product gap to close is therefore **choice-driven, measurable flows** rather than copying a generic visual canvas:

1. **Micro-quiz buttons:** three compact choices in the opening DM (for example `Start`, `Checklist`, `Examples`). Each choice records intent and delivers a tailored asset/CTA. This uses the full Instagram three-button allowance while making every click measurable.
2. **Adaptive follow-up:** one follow-up only for people who opened the flow but did not click the destination; vary its message by the button they chose and suppress it after a conversion event. This is more useful than a fixed reminder and maps to ManyChat's follow-up capability.
3. **Campaign memory:** keep a per-person preference card (topic, source post, last CTA, follow status, recent delivery). The next comment can resume the right branch instead of sending the same generic DM. It is the product-grade equivalent of ManyChat tags/custom fields, but can be purpose-built for creator funnels.

## Guardrails

- Do not promise unlimited outbound Instagram DMs. The first private reply is a constrained platform surface and follow-on messaging depends on recipient interaction / the messaging window.
- Do not make button text longer than 20 characters or use more than three buttons in one Instagram text message.
- Treat Meta delivery errors as delivery state for the individual recipient, never as a reason to disable the connected account globally.
