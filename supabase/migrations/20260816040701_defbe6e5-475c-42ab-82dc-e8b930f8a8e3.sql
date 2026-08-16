UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Good day {{contact_name}} — I''m with BajanMarket, the Barbados-only marketplace. We''re expanding our vehicle section and {{business_name}} would be a strong fit. A dealer storefront gives you a searchable inventory page, buyer enquiries straight to WhatsApp or email, and visibility with local buyers already searching for vehicles. Setup is free and we do the loading for you. Would a 15-minute walkthrough this week work?',
  followup_1_template = 'Hi {{contact_name}} — following up on the BajanMarket dealer storefront for {{business_name}}. We can have your first vehicles live within a day at no cost, and you keep every enquiry direct. Happy to send a short demo link or set a quick call — whichever is easier?',
  followup_final_template = 'Hi {{contact_name}} — last note from me. The dealer storefront offer for {{business_name}} stays open, so just reply whenever you''d like your inventory in front of Barbados buyers. Wishing you a strong season either way.'
WHERE seller_type = 'vehicle_dealer';

UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Good day {{contact_name}} — I''m with BajanMarket, the Barbados-only marketplace. Shoppers in {{parish}} search here for products like yours, and a storefront for {{business_name}} puts your catalogue, hours and contact details in front of them. It''s free to set up and we handle the initial listing work. Could I show you what your page would look like?',
  followup_1_template = 'Hi {{contact_name}} — checking back on the BajanMarket storefront for {{business_name}}. We build the page and load your first products for you, so the only step on your side is approving it. Would this week or next suit better?',
  followup_final_template = 'Hi {{contact_name}} — I''ll leave it here. Whenever {{business_name}} is ready for a free storefront in front of local shoppers, just reply and we''ll set it up the same week.'
WHERE seller_type = 'retailer';

UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Hi {{contact_name}} — I run BajanMarket, the Barbados-only marketplace. I noticed {{business_name}} posting regularly in local buy/sell groups. The difference here is that your items stay permanently searchable instead of sinking down a feed, and buyers reach you directly. A seller profile is free and we can move your current items across for you. Worth a quick look?',
  followup_1_template = 'Hi {{contact_name}} — following up on BajanMarket for {{business_name}}. We''ll set the profile up and load your listings at no cost, so your items keep working for you after the group post disappears. Want me to get it started?',
  followup_final_template = 'Hi {{contact_name}} — last note on this. If having your items permanently searchable would help {{business_name}}, reply any time and I''ll set you up.'
WHERE seller_type = 'facebook_power_seller';

UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Hi {{contact_name}} — I run BajanMarket, the Barbados-only marketplace. Your {{business_name}} page stood out. A seller profile makes your products searchable by name and price, sends enquiries straight to you, and gives customers a place to buy outside of DMs. It''s free and we''ll load your first items. Can I set one up for you?',
  followup_1_template = 'Hi {{contact_name}} — just checking in on the free BajanMarket profile for {{business_name}}. I can load your first items and send you the link to review before anything goes live. Shall I go ahead?',
  followup_final_template = 'Hi {{contact_name}} — I''ll leave it there. The free profile for {{business_name}} is available whenever you want fewer DMs and more direct enquiries. Just reply.'
WHERE seller_type = 'instagram_business';

UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Good day {{contact_name}} — I''m with BajanMarket, the Barbados-only marketplace. Customers here search for {{seller_type}} work in {{parish}} every week. A free service profile for {{business_name}} puts your services, coverage area and contact details in front of them, with enquiries coming straight to you. Would you like me to set it up?',
  followup_1_template = 'Hi {{contact_name}} — following up on the free service profile for {{business_name}}. It takes us about ten minutes to build and you approve it before it goes live. Want me to start it?',
  followup_final_template = 'Hi {{contact_name}} — last note from me. If more local enquiries would help {{business_name}}, reply any time and we''ll get the profile live.'
WHERE seller_type = 'home_service';

UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Good day {{contact_name}} — I''m with BajanMarket, the Barbados-only marketplace. We''re adding property listings and would like {{business_name}} included early. Your listings get a searchable page by parish and price, enquiries direct to your team, and no commission from us. Could I walk you through it this week?',
  followup_1_template = 'Hi {{contact_name}} — following up on property listings for {{business_name}}. Early agents get priority placement in the new section at no cost. Happy to load a few of your current listings as a sample — shall I?',
  followup_final_template = 'Hi {{contact_name}} — I''ll leave it here. The property section is open to {{business_name}} whenever the timing suits; just reply and we''ll get your listings up.'
WHERE seller_type = 'real_estate_agent';

UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Good day {{contact_name}} — I''m with BajanMarket, the Barbados-only marketplace. A free page for {{business_name}} would show your menu, specials and hours to people searching for food in {{parish}}, with orders and questions coming straight to your WhatsApp. Setup is on us. Would you like me to build it?',
  followup_1_template = 'Hi {{contact_name}} — checking back on the BajanMarket page for {{business_name}}. Send me a menu and I''ll have the page ready for your approval today, free of charge.',
  followup_final_template = 'Hi {{contact_name}} — last note on this. Whenever {{business_name}} wants a free menu page in front of local customers, just reply and we''ll sort it out.'
WHERE seller_type = 'restaurant';

UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Good day {{contact_name}} — I''m with BajanMarket, the Barbados-only marketplace with online booking built in. A bookable profile for {{business_name}} lets customers see your availability and book a slot directly, which cuts back-and-forth messages and no-shows. It''s free to set up and you control your hours. Can I show you how it works?',
  followup_1_template = 'Hi {{contact_name}} — following up on the bookable profile for {{business_name}}. You set your working hours once and customers book around them; reminders go out automatically. Want me to set it up for you to review?',
  followup_final_template = 'Hi {{contact_name}} — I''ll leave it here. If online bookings would save {{business_name}} time later on, reply any time and we''ll get you set up.'
WHERE seller_type = 'service_provider';

UPDATE public.seller_outreach_playbooks SET
  initial_template = 'Hi {{contact_name}} — I run BajanMarket, the Barbados-only marketplace. A free seller profile for {{business_name}} makes your products searchable locally, sends enquiries straight to you, and costs nothing to list. We''ll handle the setup and first listings. Would that be useful?',
  followup_1_template = 'Hi {{contact_name}} — following up on the free seller profile for {{business_name}}. We do the setup and you approve it before it goes live. Happy to start whenever you say the word.',
  followup_final_template = 'Hi {{contact_name}} — last note from me. The free profile for {{business_name}} stays available; just reply whenever you''d like it live.'
WHERE seller_type = 'general';