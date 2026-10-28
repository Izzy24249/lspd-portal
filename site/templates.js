/* Ready-made reports for the admin portal's "+ From template" button.
   Generated: edit freely, or change the forms in the builder after adding them. */
window.PORTAL_TEMPLATES = [
 {
  "theme": "ciu",
  "status": "hidden",
  "copyText": true,
  "webhookId": "",
  "watermarkMode": "single",
  "tags": {
   "base": [],
   "rules": []
  },
  "leaderboard": {
   "enabled": false,
   "countField": "",
   "webhookId": "",
   "messageId": "",
   "title": "",
   "heading": ""
  },
  "id": "cidcase",
  "section": "Reports",
  "icon": "🗂️",
  "title": "CID Case File",
  "cidApp": true,
  "forumTagOptions": [
   {
    "id": "1294796677873401949",
    "label": "Active"
   },
   {
    "id": "1294796761721999360",
    "label": "Closed"
   },
   {
    "id": "1294797024109269022",
    "label": "Narcotics & Homicide"
   },
   {
    "id": "1468876080680009738",
    "label": "Gang Task Force"
   },
   {
    "id": "1331732924818522213",
    "label": "Warrant"
   },
   {
    "id": "1470006447801630790",
    "label": "DOA Suspect"
   },
   {
    "id": "1470006695651577957",
    "label": "Suspect Arrested"
   }
  ],
  "description": "Criminal Investigations Division case file: suspects, victims, witnesses, evidence, timeline, charges and the investigator's narrative.",
  "submitLabel": "File Case to Discord",
  "color": "#d9822b",
  "discordEmoji": true,
  "logoUrl": "https://cid-case-file.netlify.app/images/lspd-ciu-badge.png",
  "discordThumb": "https://cid-case-file.netlify.app/images/lspd-ciu-badge.png",
  "embedTitle": "🗂️ LSPD CID Case File — {ccCaseNo}",
  "threadTitle": "{ccCaseNo} | {ccTitle}",
  "archiveSheet": "CID Case Files",
  "blocks": [
   {
    "type": "banner",
    "title": "CRIMINAL INVESTIGATIONS DIVISION",
    "subtitle": "Case File Report Builder · Complete each section below"
   },
   {
    "type": "text",
    "style": "heading",
    "text": "CASE INFORMATION"
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "ccCaseNo",
      "label": "Case Number",
      "type": "case_number",
      "prefix": "CID",
      "required": true
     },
     {
      "id": "ccDate",
      "label": "Date Opened",
      "type": "date",
      "defaultToday": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "ccTitle",
      "label": "Case Title",
      "type": "text",
      "placeholder": "e.g. Pacific Standard Bank Robbery",
      "required": true
     },
     {
      "id": "ccClass",
      "label": "Classification",
      "type": "select",
      "required": true,
      "options": [
       "Homicide",
       "Attempted Homicide",
       "Armed Robbery",
       "Bank Robbery",
       "Burglary",
       "Grand Theft Auto",
       "Narcotics",
       "Organized Crime / Gang",
       "Kidnapping",
       "Assault",
       "Fraud",
       "Weapons Trafficking",
       "Corruption",
       "Other"
      ]
     }
    ]
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "ccLocation",
      "label": "Location of Incident",
      "type": "text",
      "placeholder": "e.g. Legion Square"
     },
     {
      "id": "ccStatus",
      "label": "Case Status",
      "type": "select",
      "default": "Open",
      "options": [
       "Open",
       "Active Investigation",
       "Pending Warrant",
       "Pending DA Review",
       "Closed — Arrest Made",
       "Closed — Unfounded",
       "Cold Case"
      ]
     },
     {
      "id": "ccPriority",
      "label": "Priority",
      "type": "select",
      "default": "Medium",
      "options": [
       "Low",
       "Medium",
       "High",
       "Critical"
      ]
     }
    ]
   },
   {
    "type": "text",
    "style": "heading",
    "text": "INVESTIGATING PERSONNEL"
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "ccRank",
      "label": "Rank",
      "type": "select",
      "default": "Detective",
      "options": [
       "Honorary Detective",
       "Probationary Detective",
       "Detective",
       "Lead Detective",
       "Command"
      ]
     },
     {
      "id": "ccLead",
      "label": "Lead Investigator",
      "type": "text",
      "roster": true,
      "required": true,
      "placeholder": "Last name / callsign"
     },
     {
      "id": "ccBadge",
      "label": "Badge #",
      "type": "text",
      "placeholder": "417"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "ccDivision",
      "label": "Division / Department",
      "type": "text",
      "placeholder": "LSPD Criminal Investigations Division"
     },
     {
      "id": "ccCerts",
      "label": "Certifications",
      "type": "select",
      "default": "None",
      "options": [
       "None",
       "Undercover Ops",
       "Gang Task Force",
       "Undercover Ops / Gang Task Force"
      ]
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "ccAssist",
      "label": "Assisting Officers",
      "type": "officers"
     }
    ]
   },
   {
    "type": "longtext",
    "id": "ccSummary",
    "title": "INCIDENT SUMMARY",
    "hint": "Briefly describe what happened, when and where.",
    "maxLength": 2000
   },
   {
    "type": "repeater",
    "id": "ccSuspects",
    "title": "SUSPECTS",
    "addLabel": "+ Add Suspect",
    "columns": [
     {
      "id": "name",
      "label": "Full Name",
      "type": "text",
      "placeholder": "First Last"
     },
     {
      "id": "status",
      "label": "Status",
      "type": "select",
      "options": [
       "Unknown",
       "At Large",
       "In Custody",
       "Released",
       "Cooperating",
       "Hospitalized",
       "Deceased"
      ]
     },
     {
      "id": "dob",
      "label": "Date of Birth",
      "type": "text",
      "placeholder": "YYYY-MM-DD"
     },
     {
      "id": "phone",
      "label": "Phone",
      "type": "text",
      "placeholder": "555-0100"
     },
     {
      "id": "details",
      "label": "Details",
      "type": "text",
      "placeholder": "Description, tattoos, vehicle, known associates, gang affiliation…",
      "width": "wide"
     }
    ]
   },
   {
    "type": "repeater",
    "id": "ccVictims",
    "title": "VICTIMS",
    "addLabel": "+ Add Victim",
    "columns": [
     {
      "id": "name",
      "label": "Full Name",
      "type": "text",
      "placeholder": "First Last"
     },
     {
      "id": "status",
      "label": "Status",
      "type": "select",
      "options": [
       "Unknown",
       "At Large",
       "In Custody",
       "Released",
       "Cooperating",
       "Hospitalized",
       "Deceased"
      ]
     },
     {
      "id": "dob",
      "label": "Date of Birth",
      "type": "text",
      "placeholder": "YYYY-MM-DD"
     },
     {
      "id": "phone",
      "label": "Phone",
      "type": "text",
      "placeholder": "555-0100"
     },
     {
      "id": "details",
      "label": "Details",
      "type": "text",
      "placeholder": "Injuries, relation to suspect, statement…",
      "width": "wide"
     }
    ]
   },
   {
    "type": "repeater",
    "id": "ccWitnesses",
    "title": "WITNESSES",
    "addLabel": "+ Add Witness",
    "columns": [
     {
      "id": "name",
      "label": "Full Name",
      "type": "text",
      "placeholder": "First Last"
     },
     {
      "id": "status",
      "label": "Status",
      "type": "select",
      "options": [
       "Unknown",
       "At Large",
       "In Custody",
       "Released",
       "Cooperating",
       "Hospitalized",
       "Deceased"
      ]
     },
     {
      "id": "dob",
      "label": "Date of Birth",
      "type": "text",
      "placeholder": "YYYY-MM-DD"
     },
     {
      "id": "phone",
      "label": "Phone",
      "type": "text",
      "placeholder": "555-0100"
     },
     {
      "id": "details",
      "label": "Details",
      "type": "text",
      "placeholder": "What did they see or hear?",
      "width": "wide"
     }
    ]
   },
   {
    "type": "repeater",
    "id": "ccEvidence",
    "title": "EVIDENCE LOG",
    "addLabel": "+ Add Evidence",
    "columns": [
     {
      "id": "etag",
      "label": "Tag",
      "type": "text",
      "placeholder": "#12",
      "width": "narrow"
     },
     {
      "id": "type",
      "label": "Type",
      "type": "select",
      "options": [
       "Physical",
       "Firearm",
       "Ballistic",
       "DNA",
       "Biological",
       "Fingerprint",
       "Photo",
       "Video",
       "Digital",
       "Document",
       "Narcotics",
       "Currency",
       "Vehicle",
       "Other"
      ]
     },
     {
      "id": "desc",
      "label": "Description",
      "type": "text",
      "placeholder": "9mm pistol, serial filed off",
      "width": "wide"
     },
     {
      "id": "where",
      "label": "Recovered At",
      "type": "text"
     },
     {
      "id": "by",
      "label": "Collected By",
      "type": "text"
     }
    ],
    "check": {
     "id": "logged",
     "label": "Logged in CAD"
    }
   },
   {
    "type": "repeater",
    "id": "ccVehicles",
    "title": "VEHICLES INVOLVED",
    "addLabel": "+ Add Vehicle",
    "columns": [
     {
      "id": "plate",
      "label": "Plate / Tag",
      "type": "text",
      "placeholder": "46EEK572"
     },
     {
      "id": "color",
      "label": "Color",
      "type": "select",
      "options": [
       "White",
       "Black",
       "Silver",
       "Gray",
       "Red",
       "Blue",
       "Green",
       "Yellow",
       "Orange",
       "Brown",
       "Beige",
       "Gold",
       "Purple",
       "Maroon"
      ]
     },
     {
      "id": "makeModel",
      "label": "Make / Model",
      "type": "text",
      "placeholder": "Bravado Buffalo"
     }
    ],
    "check": {
     "id": "plateRun",
     "label": "Plate Run"
    }
   },
   {
    "type": "repeater",
    "id": "ccTimeline",
    "title": "TIMELINE OF EVENTS",
    "addLabel": "+ Add Entry",
    "columns": [
     {
      "id": "time",
      "label": "Time",
      "type": "text",
      "placeholder": "14:05",
      "width": "narrow"
     },
     {
      "id": "event",
      "label": "Event",
      "type": "text",
      "placeholder": "What happened",
      "width": "wide"
     }
    ]
   },
   {
    "type": "repeater",
    "id": "ccCharges",
    "title": "RECOMMENDED CHARGES",
    "addLabel": "+ Add Charge",
    "groupBy": "suspect",
    "totals": {
     "on": true,
     "col": "charge",
     "countCol": "count"
    },
    "columns": [
     {
      "id": "suspect",
      "label": "Suspect",
      "type": "link",
      "source": "ccSuspects",
      "sourceCol": "name"
     },
     {
      "id": "charge",
      "label": "Charge / penal code",
      "type": "search",
      "options": [
       "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 6 Months - $1,250 Fine)",
       "Violating boating safety regulations (Misdemeanor, 6 Months - $1,250 Fine)",
       "No Wake Zone(s) (Misdemeanor, $2,250 Fine)",
       "Operating a vessel without the proper registration (Infraction, $250 Fine)",
       "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
       "Driving without a commercial drivers license (Misdemeanor, 6 Months - $1,250 Fine)",
       "Overweight vehicle (Infraction, $250 Fine)",
       "Deflective equipment (Infraction, $250 Fine)",
       "Inadequate safety inspections (Infraction, $250 Fine)",
       "Failure to maintain logbooks (Infraction, $250 Fine)",
       "Improper transport of hazardous material (Infraction, $250 Fine)",
       "Failure to carry proper documentation (Infraction, $250 Fine)",
       "Driving without proper permits (Infraction, $250 Fine)",
       "Hours of service violation (Infraction, $250 Fine)",
       "Medical certificate violation (Infraction, $250 Fine)",
       "Improper load securement (Infraction, $250 Fine)",
       "Speeding (Infraction, $100 Fine)",
       "Running a Red Light (Infraction, $200 Fine)",
       "Driving Under the Influence (DUI) (Felony, 12 Months - $1,000 Fine)",
       "Reckless Driving (Misdemeanor, 6 Months - $500 Fine)",
       "Driving Without a License (Misdemeanor, $250 Fine)",
       "Hit and Run (Felony, 24 Months)",
       "Driving Without Insurance (Infraction, $500 Fine)",
       "Failure to Yield (Infraction, $150 Fine)",
       "Illegal U-Turn (Infraction, $100 Fine)",
       "Driving Without Headlights (Infraction, $50 Fine)",
       "Street Racing (Felony, 24 Months - $1,500 Fine)",
       "Driving in the Wrong Direction (Infraction, $200 Fine)",
       "Illegal Parking in Handicap Zones (Infraction, $200 Fine)",
       "Road Rage Incident (Misdemeanor, 6 Months - $750 Fine)",
       "Unregistered Vehicle (Infraction, $150 Fine)",
       "Excessive Window Tinting (Infraction, $100 Fine)",
       "Possession of a controlled substance (Misdemeanor, 6 Months - $1,250 Fine)",
       "Possession of a controlled substance for sale (Infraction, $250 Fine)",
       "Sale or transportation of a controlled substance (Felony, 25 Months - $7,500 Fine)",
       "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
       "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
       "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
       "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
       "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
       "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
       "Driving Under Drug Influence (Felony, 12 Months - $37,750 Fine)",
       "Possession of Drug Paraphernalia (Infraction, $200 Fine)",
       "Public Sale of Drugs (Felony, 36 Months - $2,000 Fine)",
       "Carrying a Concealed Weapon Without Permit (Felony, 36 Months)",
       "Illegal Sale of Firearms (Felony, 60 Months - $5,000 Fine)",
       "Unlawful Discharge of a Firearm (Felony, 36 Months - $4,000 Fine)",
       "Possession of a Prohibited Weapon (Felony, 48 Months - $5,000 Fine)",
       "Brandishing a Weapon (Misdemeanor, 12 Months - $750 Fine)",
       "Using a Weapon While Intoxicated (Misdemeanor, 12 Months - $1,000 Fine)",
       "Possession of a Weapon in a Restricted Area (Felony, 24 Months - $3,000 Fine)",
       "Trafficking Illegal Firearms (Felony, 72 Months - $7,000 Fine)",
       "Failure to Secure a Firearm (Misdemeanor, $500 Fine)",
       "Modifying a Firearm Illegally (Felony, 48 Months - $6,000 Fine)",
       "Possession of a Firearm Without a Serial Number (Felony, 36 Months - $4,000 Fine)",
       "Carrying a Loaded Firearm in Public (Misdemeanor, 24 Months - $2,000 Fine)",
       "Negligent Use of a Weapon (Misdemeanor, 12 Months - $1,500 Fine)",
       "Possession of a Stolen Firearm (Felony, 36 Months - $5,000 Fine)",
       "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
       "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
       "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
       "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
       "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
       "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Burglary (Felony, 24 Months)",
       "Arson (Felony, 48 Months - $2,000 Fine)",
       "Trespassing (Infraction, $200 Fine)",
       "Grand Theft (Felony, 36 Months)",
       "Breaking and Entering (Felony, 36 Months)",
       "Theft of Public Property (Felony, 36 Months)",
       "Credit Card Fraud (Felony, 24 Months - $2,000 Fine)",
       "Identity Theft (Felony, 48 Months - $2,000 Fine)",
       "Embezzlement (Felony, 10 Months)",
       "Fraud (Felony, 10 Months)",
       "Tax Evasion (Felony, 60 Months - $5,000 Fine)",
       "Money Laundering (Felony, 48 Months)",
       "Insider Trading (Felony, 36 Months)",
       "Forgery (Felony, 24 Months)",
       "Cybercrime (Felony, 60 Months)",
       "Healthcare Fraud (Felony, 48 Months)",
       "Ponzi Scheme (Felony, 120 Months)",
       "Counterfeiting (Felony, 48 Months - $2,000 Fine)",
       "Corporate Espionage (Felony, 72 Months)",
       "Assault (Misdemeanor, 12 Months)",
       "Battery (Misdemeanor, 12 Months)",
       "Aggravated Assault (Felony, 60 Months)",
       "Robbery (Felony, 36 Months)",
       "Homicide (Felony, 120 Months)",
       "Domestic Violence (Felony, 36 Months)",
       "Kidnapping (Felony, 120 Months)",
       "Terroristic Threats (Felony, 48 Months)",
       "Vehicular Manslaughter (Felony, 60 Months)",
       "Reckless Endangerment (Misdemeanor, 12 Months)",
       "Stalking (Misdemeanor, 12 Months)",
       "Online harassment (Misdemeanor, 6 Months - $1,250 Fine)",
       "Hacking (Felony, 12 Months - $37,750 Fine)",
       "Phishing (Felony, 12 Months - $37,750 Fine)",
       "Unauthorized access to computer systems (Felony, 12 Months - $37,750 Fine)",
       "Illegal dumping (Misdemeanor, 6 Months - $1,250 Fine)",
       "Overfishing (Infraction, $250 Fine)",
       "Illegal logging (Felony, 12 Months - $37,750 Fine)",
       "Endangered Species Trafficking (Felony, 12 Months - $37,750 Fine)",
       "Illegal mining (Felony, 12 Months - $37,750 Fine)",
       "Poaching (Felony, 12 Months - $37,750 Fine)",
       "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
       "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
       "Littering (Infraction, 4 Months - $1,000 Fine)",
       "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
       "Resisting (Misdemeanor, 4 Months - $1,000 Fine)",
       "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
       "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sightseeing at the Scene of an Emergency (Misdemeanor, 4 Months - $1,000 Fine)",
       "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
       "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violation of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
       "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
       "Unlawful Assembly (Misdemeanor, 4 Months - $1,000 Fine)",
       "Perjury (Felony, 7 Months - $3,000 Fine)",
       "Aiding and Abetting (Misdemeanor, 4 Months - $1,000 Fine)",
       "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
       "Marked Bills (Felony, 9 Months - $300 Fine)",
       "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
       "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
       "Bigamy (Felony, 12 Months)",
       "Disorderly Conduct (Misdemeanor, $300 Fine)",
       "Public Intoxication (Infraction, $150 Fine)",
       "Loitering (Infraction, $50 Fine)",
       "Disturbing the Peace (Infraction, $100 Fine)",
       "Illegal Protests (Infraction, $100 Fine)",
       "Indecent Exposure (Misdemeanor, $500 Fine)",
       "Rioting (Felony, 36 Months)",
       "Inciting a Riot (Felony, 48 Months)",
       "Criminal Mischief (Misdemeanor, 10 Months - $1,000 Fine)",
       "Harassment (Misdemeanor, 5 Months - $500 Fine)",
       "Obstructing Justice (Felony, 24 Months)",
       "Bribery (Felony, 36 Months - $5,000 Fine)",
       "Failure to Identify (Misdemeanor, 15 Months - $2,000 Fine)",
       "Fleeing/Attempting to Elude (Felony, 30 Months)",
       "Extortion (Felony, 30 Months - $5,000 Fine)",
       "Illegal Immigration (Felony, 100 Months)",
       "Felon in Possession of a Firearm (Felony, 30 Months)",
       "Possession of a Firearm Without a License (Misdemeanor, 30 Months)",
       "Open Carry (Felony, 5 Months - $1,500 Fine)",
       "Murder of a Government Official (Felony, 40 Months)",
       "Attempted Murder of a Government Official (Felony, 30 Months)",
       "Grand Theft Auto (Felony, 35 Months)",
       "Attempted Grand Theft Auto (Misdemeanor, 25 Months)",
       "Possession of a Stolen Vehicle (Felony, 25 Months)",
       "Felony Speeding (Felony, 30 Months)",
       "Leaving the Scene of a Vehicle Accident (Misdemeanor, 15 Months - $1,000 Fine)",
       "Failure to Maintain Lanes (Infraction, $500 Fine)",
       "Unsafe Passing (Infraction, $1,000 Fine)",
       "Failure to Yield to an Emergency Vehicle (Infraction, $1,500 Fine)",
       "Obstructed License Plate (Infraction, $500 Fine)",
       "Unsafe Hauling (Infraction, $1,500 Fine)",
       "Parking in a Fire Zone (Infraction, $500 Fine)"
      ],
      "placeholder": "Start typing, e.g. robbery"
     },
     {
      "id": "count",
      "label": "Counts",
      "type": "text",
      "placeholder": "1",
      "width": "narrow"
     }
    ],
    "check": {
     "id": "warrant",
     "label": "Warrant Req."
    }
   },
   {
    "type": "checklist",
    "id": "ccChecklist",
    "title": "INVESTIGATIVE CHECKLIST",
    "colTopic": "Task",
    "colStandard": "Standard",
    "colCheck": "Done",
    "items": [
     {
      "topic": "Scene Secured & Documented",
      "standard": "Perimeter set, scene photographed, bodycam running from arrival."
     },
     {
      "topic": "Evidence Collected & Logged",
      "standard": "Casings, blood, prints and fragments collected and entered into CAD evidence."
     },
     {
      "topic": "Prints & Serials Run",
      "standard": "Fingerprints run through CAD; weapon and vehicle serial numbers checked."
     },
     {
      "topic": "Statements Taken",
      "standard": "Victim and witness statements obtained and summarised in the narrative."
     },
     {
      "topic": "Suspect Profiles Checked",
      "standard": "All suspects run in CAD for priors, open warrants and the 5-day felon rule."
     },
     {
      "topic": "Footage Reviewed",
      "standard": "Own and assisting units' bodycam / recordings reviewed and referenced."
     },
     {
      "topic": "Warrant / Arrest Action",
      "standard": "Warrant requested or arrest made where probable cause exists."
     },
     {
      "topic": "Supervisor Notified",
      "standard": "CID supervisor briefed on case status and next steps."
     }
    ]
   },
   {
    "type": "longtext",
    "id": "ccNarrative",
    "title": "INVESTIGATOR NARRATIVE",
    "required": true,
    "followUp": true,
    "maxLength": 8000,
    "hint": "Write your full account of the investigation in first person, in the order it happened.",
    "guide": {
     "on": true,
     "steps": [
      {
       "label": "Call / Dispatch",
       "help": "How did you get involved? When, where, and who sent you?",
       "starter": "On {ccDate} at approximately [time] hours, I [was dispatched / responded] to {ccLocation} regarding a reported {ccClass}."
      },
      {
       "label": "Arrival",
       "help": "What did you see, hear and smell when you arrived? Who was there?",
       "starter": "Upon arrival, I observed [describe the scene, the people present and anything out of place]."
      },
      {
       "label": "Contacts & statements",
       "help": "Who did you speak to and what did they tell you? Quote key words exactly.",
       "starter": "I made contact with {ccVictims.name}, who stated \"[their words]\"."
      },
      {
       "label": "Investigation",
       "help": "What did you do to find out what happened? CAD checks, prints, serials, footage, canvassing.",
       "starter": "During my investigation, I [ran / checked / reviewed] [what you did], which showed [what you found]."
      },
      {
       "label": "Evidence",
       "help": "What did you collect, where exactly was it found, and was it logged in CAD?",
       "starter": "I located [evidence] at [where it was found]. I collected it and logged it into CAD evidence."
      },
      {
       "label": "Suspect & arrest",
       "help": "How was the suspect identified? What was your probable cause? When was Miranda read?",
       "starter": "I identified {ccSuspects.name} as the suspect(s) based on [probable cause]."
      },
      {
       "label": "Outcome",
       "help": "How did it end? Transport, booking, and what is still open.",
       "starter": "{ccSuspects.name} was transported to [location] and booked. This case remains [open / closed] pending [next steps]."
      }
     ],
     "tips": [
      "Write in first person and past tense: \"I observed\", not \"Officer observed\" or \"I observe\".",
      "Tell it in the order it happened, with times (e.g. 2315 hours).",
      "Stick to facts you saw, heard, or were told.",
      "Quote important statements word for word in \"quotation marks\".",
      "Explain your probable cause for every stop, search and arrest.",
      "Note when Miranda rights were read if anyone was questioned in custody."
     ],
     "mention": [
      {
       "label": "Names every suspect",
       "ref": "{ccSuspects.name}"
      },
      {
       "label": "Mentions the location",
       "ref": "{ccLocation}"
      }
     ],
     "keywords": [
      {
       "label": "Probable cause explained",
       "words": [
        "probable cause",
        "based on",
        "because"
       ]
      },
      {
       "label": "Miranda noted",
       "words": [
        "miranda"
       ]
      }
     ]
    }
   },
   {
    "type": "longtext",
    "id": "ccConclusion",
    "title": "CONCLUSION & RECOMMENDATIONS",
    "hint": "Findings, warrant requests, next steps…",
    "maxLength": 3000
   }
  ]
 },
 {
  "theme": "sheet",
  "status": "hidden",
  "copyText": true,
  "webhookId": "",
  "watermarkMode": "single",
  "tags": {
   "base": [],
   "rules": [
    {
     "field": "gtCompleted",
     "op": "equals",
     "value": "Yes",
     "tag": "1547353647380439161"
    },
    {
     "field": "gtCompleted",
     "op": "equals",
     "value": "No",
     "tag": "1547353957934833724"
    }
   ]
  },
  "leaderboard": {
   "enabled": false,
   "countField": "gtInstructorId",
   "webhookId": "",
   "messageId": "1545003227102187640",
   "title": "LSPD Academy - Monthly Leaderboard",
   "heading": "📊 **Global Operation Manual - FTO Submission Tracker** 📊"
  },
  "id": "gomtraining",
  "section": "Training",
  "discordEmoji": true,
  "icon": "📋",
  "title": "Global Operation Manual Training",
  "description": "Official training record & log: instructor, trainees, CPL witness and supervising FTO. Updates Onboarding and CPL progression.",
  "submitLabel": "Submit to Training Log",
  "color": "#2ECC71",
  "embedTitle": "📋 Global Operation Manual - Training Record",
  "threadTitle": "Global Operation Manual training - {gtDate} {gtTime} EST - {count:gtTrainees}",
  "archiveSheet": "GOM Training Log",
  "blocks": [
   {
    "type": "banner",
    "title": "GLOBAL OPERATION MANUAL",
    "subtitle": "OFFICIAL TRAINING RECORD & LOG"
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "gtDate",
      "label": "Date:",
      "type": "date",
      "defaultToday": true,
      "required": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "gtTime",
      "label": "Time (EST):",
      "type": "time",
      "required": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "gtDuration",
      "label": "Duration (in mins):",
      "type": "number"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "gtInstructor",
      "label": "Instructor:",
      "type": "officer",
      "required": true,
      "rosterTabName": "FTO - Roster",
      "fillId": "gtInstructorId",
      "allowTyped": true
     },
     {
      "id": "gtInstructorId",
      "label": "Instructor (Discord ID):",
      "type": "discord_id"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "gtCompleted",
      "label": "Completed Global Operation Manual Training:",
      "type": "select",
      "required": true,
      "options": [
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "gtWitness",
      "label": "Witness (CPL):",
      "type": "officer",
      "rosterTabName": "FTO - Roster",
      "onlyCol": "C",
      "onlyMatch": "L-5##",
      "allowTyped": true
     },
     {
      "id": "gtSupervisor",
      "label": "Supervising Certified FTO:",
      "type": "officer",
      "rosterTabName": "FTO - Roster",
      "allowTyped": true
     }
    ]
   },
   {
    "type": "text",
    "style": "hint",
    "text": "Witness: a CPL sitting in (counts toward their \"Witness a GOM Training\"). Supervising FTO: only when a CPL is the instructor (counts as their \"Lead a GOM Training\"; left empty it counts as running one on their own)."
   },
   {
    "type": "repeater",
    "id": "gtTrainees",
    "title": "TRAINEES",
    "addLabel": "+ Add Trainee",
    "numbered": true,
    "startRows": 1,
    "columns": [
     {
      "id": "trainee",
      "label": "Trainee (Discord ID)",
      "type": "officer",
      "rosterTabName": "Onboarding",
      "callCol": "A",
      "width": "wide"
     },
     {
      "id": "notes",
      "label": "Additional Notes",
      "type": "text"
     }
    ]
   }
  ]
 },
 {
  "theme": "k9",
  "status": "hidden",
  "copyText": true,
  "webhookId": "",
  "watermarkMode": "single",
  "tags": {
   "base": [],
   "rules": []
  },
  "leaderboard": {
   "enabled": false,
   "countField": "",
   "webhookId": "",
   "messageId": "",
   "title": "",
   "heading": ""
  },
  "id": "k9",
  "logoUrl": "img/k9-patch.png",
  "discordThumb": "https://raw.githubusercontent.com/Izzy24249/lspd-portal/main/site/img/k9-patch.png",
  "watermark": "custom",
  "watermarkUrl": "img/k9-patch.png",
  "watermarkOpacity": 4,
  "icon": "🐕",
  "title": "K9 Unit Report",
  "description": "K9 patrol activity: traffic, calls for service and K9 deployments.",
  "submitLabel": "Submit K9 Report",
  "color": "#16a34a",
  "embedTitle": "🐕 LSPD K9 Unit Report — {k9No}",
  "threadTitle": "{k9No} | {k9Handler}",
  "archiveSheet": "K9 Reports",
  "hours": {
   "on": true,
   "dateField": "k9Date",
   "startField": "k9Start",
   "endField": "k9End",
   "people": [
    "k9Handler",
    "k9Assist"
   ]
  },
  "blocks": [
   {
    "type": "banner",
    "title": "LSPD - K9 UNIT REPORT",
    "subtitle": "Patrol activity, calls for service and K9 deployments."
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "k9No",
      "label": "K9 Report #:",
      "type": "case_number",
      "prefix": "K9",
      "required": true
     },
     {
      "id": "k9Cad",
      "label": "CAD Case #:",
      "type": "text"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "k9Handler",
      "label": "Handler:",
      "type": "officer",
      "required": true,
      "rosterTabName": "K-9 - Roster",
      "pairCol": "J",
      "pairFill": "k9Dog"
     },
     {
      "id": "k9Dog",
      "label": "K9 Partner:",
      "type": "text",
      "placeholder": "Fills in when you pick the handler"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "k9Assist",
      "label": "Assisting Units:",
      "type": "officers",
      "rosterTabName": "K-9 - Roster",
      "allowTyped": true
     }
    ]
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "k9Date",
      "label": "Date",
      "type": "date",
      "defaultToday": true
     },
     {
      "id": "k9Start",
      "label": "Start Time",
      "type": "time",
      "required": true
     },
     {
      "id": "k9End",
      "label": "End Time",
      "type": "time",
      "required": true
     },
     {
      "id": "k9Area",
      "label": "Area / Postal",
      "type": "text",
      "placeholder": "Postal 388"
     }
    ]
   },
   {
    "type": "repeater",
    "id": "k9Activity",
    "title": "ACTIVITY LOG",
    "addLabel": "+ Add Activity",
    "columns": [
     {
      "id": "time",
      "label": "Time",
      "type": "text",
      "placeholder": "14:30",
      "width": "narrow"
     },
     {
      "id": "activity",
      "label": "Activity",
      "type": "select",
      "blank": true,
      "options": [
       "Traffic Stop",
       "Call Response",
       "K9 Deployment",
       "Arrest",
       "Citation",
       "10-80 Pursuit",
       "Backup / Assist",
       "Search",
       "Other"
      ]
     },
     {
      "id": "notes",
      "label": "Location / Notes",
      "type": "text",
      "width": "wide"
     }
    ]
   },
   {
    "type": "text",
    "style": "heading",
    "text": "K9 DEPLOYMENT (leave as \"No deployment\" if the K9 wasn't used)"
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "k9DeployType",
      "label": "Deployment Type",
      "type": "select",
      "default": "No deployment",
      "options": [
       "No deployment",
       "Tracking",
       "Narcotics Sniff",
       "Article / Evidence Search",
       "Building Search",
       "Area Search",
       "Apprehension",
       "Crowd Control",
       "Public Demo"
      ]
     },
     {
      "id": "k9Outcome",
      "label": "Outcome",
      "type": "select",
      "default": "N/A",
      "options": [
       "N/A",
       "Suspect Located",
       "Suspect Apprehended",
       "Narcotics Found",
       "Evidence Found",
       "Nothing Found",
       "Called Off"
      ]
     },
     {
      "id": "k9Contact",
      "label": "K9 Contact / Bite",
      "type": "select",
      "default": "None",
      "options": [
       "None",
       "Bite - Suspect",
       "Bite - Other"
      ]
     },
     {
      "id": "k9Medical",
      "label": "Medical Rendered",
      "type": "select",
      "default": "N/A",
      "options": [
       "N/A",
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "type": "repeater",
    "id": "k9Persons",
    "title": "INVOLVED PERSONS",
    "addLabel": "+ Add Person",
    "columns": [
     {
      "id": "role",
      "label": "Role",
      "type": "select",
      "options": [
       "Suspect",
       "Victim",
       "Witness",
       "Driver",
       "Passenger",
       "Complainant"
      ]
     },
     {
      "id": "name",
      "label": "Name / DOB",
      "type": "text",
      "placeholder": "John Doe · 01/01/1990"
     },
     {
      "id": "notes",
      "label": "Notes (State ID, injuries)",
      "type": "text"
     }
    ],
    "check": {
     "id": "profileRun",
     "label": "Profile Run"
    }
   },
   {
    "type": "repeater",
    "id": "k9Vehicles",
    "title": "VEHICLES",
    "addLabel": "+ Add Vehicle",
    "columns": [
     {
      "id": "plate",
      "label": "Plate / Tag",
      "type": "text",
      "placeholder": "46EEK572"
     },
     {
      "id": "color",
      "label": "Color",
      "type": "select",
      "options": [
       "White",
       "Black",
       "Silver",
       "Gray",
       "Red",
       "Blue",
       "Green",
       "Yellow",
       "Orange",
       "Brown",
       "Beige",
       "Gold",
       "Purple",
       "Maroon"
      ]
     },
     {
      "id": "makeModel",
      "label": "Make / Model",
      "type": "text",
      "placeholder": "Bravado Buffalo"
     }
    ],
    "check": {
     "id": "plateRun",
     "label": "Plate Run"
    }
   },
   {
    "type": "repeater",
    "id": "k9Charges",
    "title": "CHARGES",
    "addLabel": "+ Add Charge",
    "groupBy": "suspect",
    "totals": {
     "on": true,
     "col": "charge",
     "countCol": "count"
    },
    "columns": [
     {
      "id": "suspect",
      "label": "Suspect",
      "type": "link",
      "source": "k9Persons",
      "sourceCol": "name",
      "filterCol": "role",
      "filterValue": "Suspect"
     },
     {
      "id": "charge",
      "label": "Charge (type to search)",
      "type": "search",
      "options": [
       "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violating boating safety regulations (Misdemeanor, 4 Months - $1,000 Fine)",
       "No Wake Zone (Misdemeanor, $1,750 Fine)",
       "Operating a vessel without the proper registration (Infraction, $250 Fine)",
       "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
       "Driving Without a Commercial Driver's License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Submit Vehicle to Inspection (Misdemeanor, 4 Months - $2,250 Fine)",
       "Overweight Vehicle (Infraction, $250 Fine)",
       "Defective Equipment (Infraction, $250 Fine)",
       "Inadequate Safety Inspections (Infraction, $250 Fine)",
       "Failure to Maintain Logbooks (Infraction, $250 Fine)",
       "Improper Transport of Hazardous Materials (Infraction, $250 Fine)",
       "Failure to Carry Proper Documentation (Infraction, $250 Fine)",
       "Driving Without Proper Permits (Infraction, $250 Fine)",
       "Hours of Service Violation (Infraction, $250 Fine)",
       "Medical Certificate Violation (Infraction, $250 Fine)",
       "Improper Load Securement (Infraction, $250 Fine)",
       "Online Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Phishing (Felony, 7 Months - $3,000 Fine)",
       "Unauthorized Access to Computer Systems (Felony, 7 Months - $3,000 Fine)",
       "Possession of Controlled Substances (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
       "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Driving Under Drug Influence (Felony, 7 Months - $3,000 Fine)",
       "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
       "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
       "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
       "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
       "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
       "Public Sale of Drugs (Felony, 7 Months - $3,000 Fine)",
       "Possession of Drug Paraphernalia (Felony, 7 Months - $3,000 Fine)",
       "Illegal Dumping (Misdemeanor, 4 Months - $1,000 Fine)",
       "Overfishing (Infraction, $250 Fine)",
       "Illegal Logging (Felony, 7 Months - $3,000 Fine)",
       "Endangered Species Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Illegal Mining (Felony, 7 Months - $3,000 Fine)",
       "Poaching (Felony, 7 Months - $3,000 Fine)",
       "Careless or Reckless Aircraft Operation (Misdemeanor, 5 Months - $1,000 Fine)",
       "Operating Without a Pilot Certificate (Misdemeanor, 5 Months - $1,000 Fine)",
       "Consuming Personal Alcohol Aboard an Aircraft (Misdemeanor, 5 Months - $2,500 Fine)",
       "Boarding While Intoxicated (Misdemeanor, 5 Months - $1,500 Fine)",
       "Undeclared Hazardous Materials (Misdemeanor, 5 Months - $1,000 Fine)",
       "Falsification of FAA Records (Felony, 10 Months - $2,500 Fine)",
       "Violation of a Temporary Flight Restriction (Felony, 5 Months - $3,500 Fine)",
       "Operating an Aircraft to Facilitate Drug Trafficking (Felony, 20 Months - $5,000 Fine)",
       "Assault Aboard an Aircraft (Felony, 15 Months - $2,500 Fine)",
       "Carrying a Weapon Aboard an Aircraft (Felony, 15 Months - $5,000 Fine)",
       "Carrying an Explosive or Incendiary Device Aboard (Felony, 20 Months - $5,000 Fine)",
       "Aircraft Hijacking (Felony, 20 Months - $5,000 Fine)",
       "Criminal Transportation of Hazardous Materials (Felony, 15 Months - $2,500 Fine)",
       "Failure to Declare an Item (Misdemeanor, 5 Months - $1,000 Fine)",
       "Importing Prohibited Agricultural Items (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare a Firearm (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare Prescription Medication (Misdemeanor, 5 Months - $1,000 Fine)",
       "Improper Entry (Felony, 15 Months - $5,000 Fine)",
       "Illegal Re-entry (Felony, 20 Months - $5,000 Fine)",
       "Alien Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Attempted Human Smuggling (Felony, 15 Months - $2,500 Fine)",
       "Conspiracy to Commit Human Trafficking (Felony, 15 Months - $5,000 Fine)",
       "Visa or Immigration-Document Fraud (Felony, 15 Months - $5,000 Fine)",
       "Unlawful Transportation (Felony, 15 Months - $2,500 Fine)",
       "Bringing a Person Through an Unauthorized Location (Felony, 15 Months - $3,500 Fine)",
       "Passport Forgery or False Use (Felony, 15 Months - $2,500 Fine)",
       "High-Speed Flight From an Immigration Checkpoint (Felony, 10 Months - $2,500 Fine)",
       "Forcibly Resisting or Impeding a Federal Agent (Felony, 10 Months - $500 Fine)",
       "Aggravated Assault on a Federal Agent (Felony, 15 Months - $2,000 Fine)",
       "False Statements to a Federal Agent (Felony, 5 Months - $500 Fine)",
       "Possession of Contraband at a Checkpoint (Felony, 10 Months - $1,000 Fine)",
       "Alien Smuggling Discovered at a Checkpoint (Felony, 15 Months - $2,000 Fine)",
       "False Customs Declaration (Felony, 10 Months - $2,500 Fine)",
       "Smuggling Goods Into the United States (Felony, 10 Months - $1,000 Fine)",
       "Undeclared Currency or Monetary Instruments (Felony, 15 Months - $2,000 Fine)",
       "Illegal Importation of a Firearm (Felony, 7 Months - $1,000 Fine)",
       "Firearm Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Drug Smuggling Through Concealment (Felony, 20 Months - $5,000 Fine)",
       "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Arrest (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
       "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violation Of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
       "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
       "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
       "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sightseeing at the Scene of an Emergency (Misdemeanor, 6 Months - $1,200 Fine)",
       "Unlawful Assembly (Infraction, $250 Fine)",
       "Littering (Infraction, $250 Fine)",
       "Perjury (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
       "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
       "Aiding and Abetting (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Peace Officer (Felony, 7 Months - $3,000 Fine)",
       "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
       "Marked Bills (Felony, 9 Months - $3,000 Fine)",
       "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
       "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
       "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
       "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
       "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
       "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
       "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
       "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Trespassing (Infraction, $250 Fine)",
       "Burglary (Felony, 11 Months - $6,000 Fine)",
       "Arson (Felony, 14 Months - $10,000 Fine)",
       "Credit Card Fraud (Felony, 5 Months - $3,000 Fine)",
       "Breaking and Entering (Felony, 5 Months - $3,000 Fine)",
       "Identity Theft (Felony, 5 Months - $3,000 Fine)",
       "Theft of Public Property (Felony, 5 Months - $3,000 Fine)",
       "Extortion (Felony, 5 Months - $3,000 Fine)",
       "Attempted Robbery (Felony, 8 Months - $3,000 Fine)",
       "Disorderly Conduct (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Intoxication (Misdemeanor, 4 Months - $1,000 Fine)",
       "Indecent Exposure (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Mischief (Misdemeanor, 4 Months - $1,000 Fine)",
       "Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Aiding & Abetting (Misdemeanor) (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Identify (Misdemeanor, 4 Months - $1,000 Fine)",
       "Loitering (Infraction, $250 Fine)",
       "Disturbing the Peace (Infraction, $250 Fine)",
       "Illegal Protests (Infraction, $250 Fine)",
       "Rioting (Felony, 7 Months - $3,000 Fine)",
       "Bribery (Felony, 7 Months - $3,000 Fine)",
       "Inciting a Riot (Felony, 7 Months - $3,000 Fine)",
       "Illegal Immigration (Felony, 7 Months - $3,000 Fine)",
       "Reckless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Driving Without a License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Road Rage Incident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Attempted Grand Theft Auto (Misdemeanor, 7 Months - $3,000 Fine)",
       "Leaving the Scene of a Vehicle Accident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Careless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Operating a Vehicle with Suspended License (Misdemeanor)",
       "Driving a Motorcycle Without a Motorcycle License (Misdemeanor, $500 Fine)",
       "Speeding (Infraction, $250 Fine)",
       "Running a Red Light (Infraction, $250 Fine)",
       "Driving Without Insurance (Infraction, $250 Fine)",
       "Failure to Yield (Infraction, $250 Fine)",
       "Illegal U-Turn (Infraction, $250 Fine)",
       "Driving Without Headlights (Infraction, $250 Fine)",
       "Driving in the Wrong Direction (Infraction, $250 Fine)",
       "Illegal Parking in Handicap Zones (Infraction, $250 Fine)",
       "Excessive Window Tinting (Infraction, $250 Fine)",
       "Failure to Maintain Lanes (Infraction, $250 Fine)",
       "Unsafe Passing (Infraction, $250 Fine)",
       "Failure to Yield to an Emergency Vehicle (Infraction, $250 Fine)",
       "Obstructed License Plate (Infraction, $250 Fine)",
       "Unsafe Hauling (Infraction, $250 Fine)",
       "Parking in a Fire Zone (Infraction, $250 Fine)",
       "Failure to Yield to a Traffic Device (Infraction, $250 Fine)",
       "Improper Vehicle Safety Equipment (Infraction, $250 Fine)",
       "Operating an Unroadworthy Vehicle on a Public Roadway (Infraction, $250 Fine)",
       "Lighting Violation (Infraction, $250 Fine)",
       "Improper Parking, Stopping, or Standing (Infraction, $250 Fine)",
       "Unsafe Lane Changes (Infraction, $250 Fine)",
       "Operating a Motorcycle Without a Helmet (Infraction, $250 Fine)",
       "Impeding Traffic (Infraction, $250 Fine)",
       "Using a Handheld Device While Driving (Infraction, $250 Fine)",
       "Improper Use of Horn (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrian in Crosswalk (Infraction, $250 Fine)",
       "Crossing a Double Yellow Line (Infraction, $250 Fine)",
       "Passing on the Shoulder (Infraction, $250 Fine)",
       "Towing Without a License (Infraction, $500 Fine)",
       "Move Over Law (Infraction, $250 Fine)",
       "Illegally Parked in a No Parking Zone (Infraction, $250 Fine)",
       "Failure to Pay for Parking Meter (Infraction, $250 Fine)",
       "Blocking a Driveway (Infraction, $250 Fine)",
       "Blocking a Crosswalk (Infraction, $250 Fine)",
       "Facing the Wrong Way (Infraction, $250 Fine)",
       "Bus Stop Violation (Infraction, $250 Fine)",
       "Blocking an Intersection (Infraction, $250 Fine)",
       "Parking Within 15 Feet of a Fire Station Driveway (Infraction, $250 Fine)",
       "Blocking Railroad Crossing (Infraction, $250 Fine)",
       "Parking on a Sidewalk Median or Divider (Infraction, $250 Fine)",
       "Unregistered Vehicle (Infraction, $250 Fine)",
       "Towing Without a Valid Operator's License (Infraction, $500 Fine)",
       "Failure to Signal (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrians (Infraction, $250 Fine)",
       "Blocking Emergency Access Lanes (Infraction, $250 Fine)",
       "Expired Insurance (Infraction, $250 Fine)",
       "Fictitious Plate (Infraction, $250 Fine)",
       "Prohibited Underglow Lighting (Infraction, $250 Fine)",
       "Tailgating (Infraction, $250 Fine)",
       "Plate Violation (Infraction, $250 Fine)",
       "Operating a Vehicle While Using a Miscellaneous Object (Infraction, $500 Fine)",
       "Occupying a Side of the Freeway (Infraction, $250 Fine)",
       "Parking in an Alley Way (Infraction, $250 Fine)",
       "Unlawful Riding in a Vehicle (Infraction, $500 Fine)",
       "Driving Under the Influence (DUI) (Felony, 7 Months - $3,000 Fine)",
       "Hit and Run (Felony, 7 Months - $3,000 Fine)",
       "Street Racing (Felony, 7 Months - $3,000 Fine)",
       "Fleeing/Attempting to Elude (Felony, 7 Months - $3,000 Fine)",
       "Possession of a Stolen Vehicle (Felony, 7 Months - $3,000 Fine)",
       "Felony Speeding (Felony, 9 Months - $6,000 Fine)",
       "Grand Theft Auto (Felony, 7 Months - $6,000 Fine)",
       "Assault (Misdemeanor, 7 Months - $3,000 Fine)",
       "Battery (Misdemeanor, 7 Months - $3,000 Fine)",
       "Reckless Endangerment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Stalking (Misdemeanor, 7 Months - $3,000 Fine)",
       "Robbery (Felony, 15 Months - $6,000 Fine)",
       "Homicide (Felony, 18 Months - $10,000 Fine)",
       "Domestic Violence (Felony, 15 Months - $6,000 Fine)",
       "Kidnapping (Felony, 18 Months - $10,000 Fine)",
       "Aggravated Assault (Felony, 18 Months - $10,000 Fine)",
       "Terroristic Threats (Felony, 7 Months - $3,000 Fine)",
       "Vehicular Manslaughter (Felony, 18 Months - $10,000 Fine)",
       "Attempted Murder of a Government Official (Felony, 18 Months - $6,000 Fine)",
       "Brandishing a Firearm in Public (Felony, 15 Months - $6,000 Fine)",
       "Assault of a Peace Officer (Felony, 15 Months - $6,000 Fine)",
       "Attempted Murder (Felony, 18 Months - $10,000 Fine)",
       "Armed Robbery (Felony, 18 Months - $9,000 Fine)",
       "Aggravated Battery (Felony, 15 Months - $6,000 Fine)",
       "Battery on a Law Enforcement Officer (Felony, 15 Months - $6,000 Fine)",
       "Second-Degree Murder (Felony, 15 Months - $6,000 Fine)",
       "Capital Murder (Felony, 15 Months - $6,000 Fine)",
       "Carjacking (Felony, 15 Months - $6,000 Fine)",
       "Solicitation to Commit Murder (Felony, 9 Months - $10,000 Fine)",
       "Obstructing Justice (Felony, 7 Months - $3,000 Fine)",
       "Possession of Assault Weapon (Felony, 7 Months - $2,250 Fine)",
       "Brandishing a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Using a Weapon While Intoxicated (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Secure a Firearm (Misdemeanor, 7 Months - $3,000 Fine)",
       "Carrying a Loaded Firearm in Public (Misdemeanor, 7 Months - $3,000 Fine)",
       "Negligent Use of a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Possession of a Firearm Without a License (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Report Lost/Stolen Firearm (Misdemeanor, 4 Months - $1,000 Fine)",
       "Firearm in a Restricted Zone (Misdemeanor, 4 Months - $1,000 Fine)",
       "Carrying a Concealed Weapon Without Permit (Felony, 15 Months - $6,000 Fine)",
       "Illegal Sale of Firearms (Felony, 15 Months - $6,000 Fine)",
       "Unlawful Discharge of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Prohibited Weapon (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Weapon in a Restricted Area (Felony, 15 Months - $6,000 Fine)",
       "Trafficking Illegal Firearms (Felony, 15 Months - $6,000 Fine)",
       "Modifying a Firearm Illegally (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Firearm Without a Serial Number (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Stolen Firearm (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Open Carry (Felony, 7 Months - $3,000 Fine)",
       "Reckless Firearm Discharge (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of Deadly Weapon (Felony, 15 Months - $6,000 Fine)",
       "Discharge of a Firearm in City Limits (Felony, 15 Months - $6,000 Fine)",
       "Unserialized (\"Ghost\") Firearm (Felony, 15 Months - $6,000 Fine)",
       "Carrying Firearm While Masked (Felony, 15 Months - $6,000 Fine)",
       "Undetectable Firearm (Felony, 15 Months - $6,000 Fine)",
       "Sale to Prohibited Person (Felony, 15 Months - $6,000 Fine)",
       "Straw Purchase of Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of an Unregistered Firearm (Felony, 9 Months)",
       "Illegal Transfer of a Firearm (Felony, 12 Months - $6,000 Fine)",
       "Possession of Ammunition by a Felon (Felony, 9 Months - $4,000 Fine)",
       "Possession of Explosive Device(s) (Felony, 18 Months - $8,000 Fine)",
       "Carrying a Firearm While Being Underage (Felony, 9 Months - $2,000 Fine)",
       "Possession of a Weapon in Commission of a Crime (Felony, 12 Months - $6,000 Fine)",
       "Possession of an Illegal Firearm Modification (Felony, 12 Months - $1,200 Fine)",
       "Embezzlement (Felony, 11 Months - $6,000 Fine)",
       "Fraud (Felony, 5 Months - $3,000 Fine)",
       "Tax Evasion (Felony, 5 Months - $3,000 Fine)",
       "Money Laundering (Felony, 5 Months - $3,000 Fine)",
       "Insider Trading (Felony, 5 Months - $3,000 Fine)",
       "Forgery (Felony, 5 Months - $3,000 Fine)",
       "Cybercrime (Felony, 5 Months - $3,000 Fine)",
       "Healthcare Fraud (Felony, 5 Months - $3,000 Fine)",
       "Ponzi Scheme (Felony, 5 Months - $3,000 Fine)",
       "Counterfeiting (Felony, 5 Months - $3,000 Fine)",
       "Corporate Espionage (Felony, 5 Months - $3,000 Fine)",
       "Animal Abuse and Cruelty (Misdemeanor, 4 Months - $1,000 Fine)",
       "Possession of Illegally Taken Wildlife (Misdemeanor, 4 Months - $1,000 Fine)",
       "Importation of Restricted Animals (Misdemeanor, 4 Months - $1,000 Fine)",
       "Exceeding Daily Catch Limits (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Out of Season or in Protected Areas (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sale of Illegally Taken Fish (Misdemeanor, 4 Months - $1,000 Fine)",
       "Endangered Species Violation (Misdemeanor, 4 Months - $1,000 Fine)",
       "Using Illegal Fishing Gear or Methods (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Without a License (Infraction, $250 Fine)"
      ],
      "placeholder": "Start typing, e.g. robbery"
     },
     {
      "id": "count",
      "label": "Counts",
      "type": "text",
      "placeholder": "1",
      "width": "narrow"
     }
    ],
    "check": {
     "id": "warrant",
     "label": "Warrant Req."
    }
   },
   {
    "type": "checklist",
    "id": "k9Checklist",
    "title": "K9 CHECKLIST",
    "colTopic": "Task",
    "colStandard": "Standard",
    "colCheck": "Done",
    "items": [
     {
      "topic": "K9 Warning Announced",
      "standard": "Required before any deployment (skip if the K9 wasn't deployed)."
     },
     {
      "topic": "Bodycam Active",
      "standard": "Bodycam / recording running for the whole shift."
     },
     {
      "topic": "K9 Checked & Watered",
      "standard": "K9 checked for injuries and given water after the shift."
     },
     {
      "topic": "Supervisor Notified (Bite)",
      "standard": "Required whenever K9 contact or a bite occurs."
     }
    ]
   },
   {
    "type": "longtext",
    "id": "k9Narrative",
    "title": "NARRATIVE / NOTES",
    "hint": "Summarise the shift and explain any K9 deployment in detail.",
    "maxLength": 8000,
    "required": false,
    "followUp": true,
    "guide": {
     "on": true,
     "steps": [
      {
       "label": "Shift start",
       "help": "When and where did your patrol start, and with which K9?",
       "starter": "On {k9Date} at approximately {k9Start} hours, I began patrol with K9 {k9Dog} in the {k9Area} area."
      },
      {
       "label": "Calls & traffic",
       "help": "Main calls and stops you handled.",
       "starter": "During my shift I [responded to / conducted] [calls, traffic stops] at [locations]."
      },
      {
       "label": "K9 request",
       "help": "Who requested the K9 and why?",
       "starter": "At approximately [time] hours, [unit] requested a K9 for [reason]."
      },
      {
       "label": "Deployment",
       "help": "Warning given? What did the K9 do, and what did it indicate?",
       "starter": "I announced a K9 warning and deployed K9 {k9Dog} for a {k9DeployType}. The K9 [indicated / located] [what]."
      },
      {
       "label": "Outcome",
       "help": "How did it end? Any contact/bite and medical?",
       "starter": "The deployment resulted in {k9Outcome}. K9 contact: {k9Contact}."
      },
      {
       "label": "End of shift",
       "help": "When did you end, and what's still open?",
       "starter": "I ended my shift at approximately {k9End} hours. [Outstanding items]."
      }
     ],
     "tips": [
      "Write in first person and past tense: \"I observed\", not \"Officer observed\".",
      "Tell it in the order it happened, with times (e.g. 2315 hours).",
      "Stick to facts you saw, heard or were told.",
      "Quote important statements word for word.",
      "Re-read it once: would someone who wasn't there understand what happened?"
     ],
     "mention": [],
     "keywords": []
    }
   }
  ]
 },
 {
  "theme": "asu",
  "status": "hidden",
  "copyText": true,
  "webhookId": "",
  "watermarkMode": "single",
  "tags": {
   "base": [],
   "rules": []
  },
  "leaderboard": {
   "enabled": false,
   "countField": "",
   "webhookId": "",
   "messageId": "",
   "title": "",
   "heading": ""
  },
  "id": "asu",
  "logoUrl": "img/asu-patch.png",
  "discordThumb": "https://raw.githubusercontent.com/Izzy24249/lspd-portal/main/site/img/asu-patch.png",
  "watermark": "custom",
  "watermarkUrl": "img/asu-patch.png",
  "watermarkOpacity": 4,
  "icon": "🚁",
  "title": "ASU Flight Report",
  "description": "Air Support Unit flight log: pilot, aircraft and everything done in the air.",
  "submitLabel": "Submit Flight Report",
  "color": "#0ea5e9",
  "embedTitle": "🚁 LSPD ASU Flight Report — {asuNo}",
  "threadTitle": "{asuNo} | {asuAircraft} | {asuPilot}",
  "archiveSheet": "ASU Flights",
  "hours": {
   "on": true,
   "dateField": "asuDate",
   "startField": "asuTakeoff",
   "endField": "asuLanding",
   "people": [
    "asuPilot",
    "asuTfo"
   ]
  },
  "blocks": [
   {
    "type": "banner",
    "title": "LSPD - AIR SUPPORT UNIT (ASU) FLIGHT REPORT",
    "subtitle": "Flight log: crew, aircraft and every event handled from the air."
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "asuNo",
      "label": "Flight #:",
      "type": "case_number",
      "prefix": "ASU",
      "required": true
     },
     {
      "id": "asuCad",
      "label": "CAD Case #:",
      "type": "text"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "asuPilot",
      "label": "Pilot:",
      "type": "officer",
      "required": true,
      "rosterTabName": "ASU - Roster"
     },
     {
      "id": "asuTfo",
      "label": "Tactical Flight Officer:",
      "type": "officer",
      "rosterTabName": "ASU - Roster"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "asuAircraft",
      "label": "Aircraft:",
      "type": "select",
      "required": true,
      "options": [
       "Air-1",
       "Air-2",
       "Air-3"
      ]
     },
     {
      "id": "asuSupported",
      "label": "Supported Units:",
      "type": "officers",
      "allowTyped": true
     }
    ]
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "asuDate",
      "label": "Date",
      "type": "date",
      "defaultToday": true
     },
     {
      "id": "asuTakeoff",
      "label": "Takeoff",
      "type": "time",
      "required": true
     },
     {
      "id": "asuLanding",
      "label": "Landing",
      "type": "time",
      "required": true
     },
     {
      "id": "asuStatus",
      "label": "Aircraft Status",
      "type": "select",
      "default": "✅ OK",
      "options": [
       "✅ OK",
       "🟡 Minor Damage",
       "🟠 Major Damage",
       "🔴 Crash"
      ]
     }
    ]
   },
   {
    "type": "repeater",
    "id": "asuEvents",
    "title": "EVENTS",
    "addLabel": "+ Add Event",
    "columns": [
     {
      "id": "time",
      "label": "Time",
      "type": "text",
      "placeholder": "14:30",
      "width": "narrow"
     },
     {
      "id": "event",
      "label": "Event",
      "type": "select",
      "blank": true,
      "options": [
       "10-80 Pursuit",
       "Scene Response",
       "Search / Perimeter",
       "Surveillance",
       "Patrol",
       "Rescue / Medical Support",
       "Transport",
       "Training",
       "Other"
      ]
     },
     {
      "id": "notes",
      "label": "Location / Notes",
      "type": "text",
      "width": "wide"
     }
    ],
    "check": {
     "id": "groundUpdated",
     "label": "Ground Updated"
    }
   },
   {
    "type": "repeater",
    "id": "asuTargets",
    "title": "TARGETS TRACKED",
    "addLabel": "+ Add Target",
    "columns": [
     {
      "id": "plate",
      "label": "Plate / Description",
      "type": "text",
      "placeholder": "46EEK572 / male on foot"
     },
     {
      "id": "vehicle",
      "label": "Make / Model / Color",
      "type": "text",
      "placeholder": "Black Bravado Buffalo"
     },
     {
      "id": "result",
      "label": "Result",
      "type": "select",
      "options": [
       "Stopped",
       "Lost",
       "Terminated",
       "Handed Off"
      ]
     }
    ]
   },
   {
    "type": "longtext",
    "id": "asuSummary",
    "title": "FLIGHT SUMMARY",
    "hint": "Anything the event list doesn't cover: conditions, coordination, issues.",
    "maxLength": 4000,
    "required": false,
    "followUp": true,
    "guide": {
     "on": true,
     "steps": [
      {
       "label": "Takeoff",
       "help": "When did you lift off, from where, and why?",
       "starter": "On {asuDate} at {asuTakeoff} hours, {asuAircraft} departed [helipad] for [reason]."
      },
      {
       "label": "Main event",
       "help": "The key event of the flight (e.g. the 10-80).",
       "starter": "At approximately [time] hours, I [joined / took over] [event] at [location]."
      },
      {
       "label": "Ground coordination",
       "help": "Which ground units did you guide, and how?",
       "starter": "I relayed [locations / direction of travel] to [units] until [result]."
      },
      {
       "label": "Landing",
       "help": "When and where did you land? Any damage?",
       "starter": "{asuAircraft} returned and landed at {asuLanding} hours. Aircraft status: {asuStatus}."
      }
     ],
     "tips": [
      "Write in first person and past tense: \"I observed\", not \"Officer observed\".",
      "Tell it in the order it happened, with times (e.g. 2315 hours).",
      "Stick to facts you saw, heard or were told.",
      "Quote important statements word for word.",
      "Re-read it once: would someone who wasn't there understand what happened?"
     ],
     "mention": [],
     "keywords": []
    }
   }
  ]
 },
 {
  "theme": "cru",
  "status": "hidden",
  "copyText": true,
  "webhookId": "",
  "watermarkMode": "single",
  "tags": {
   "base": [],
   "rules": []
  },
  "leaderboard": {
   "enabled": false,
   "countField": "",
   "webhookId": "",
   "messageId": "",
   "title": "",
   "heading": ""
  },
  "id": "cru",
  "logoUrl": "img/cru-patch.png",
  "discordThumb": "https://raw.githubusercontent.com/Izzy24249/lspd-portal/main/site/img/cru-patch.png",
  "watermark": "custom",
  "watermarkUrl": "img/cru-patch.png",
  "watermarkOpacity": 4,
  "icon": "🛟",
  "title": "CRU Incident Report",
  "description": "Crisis Response Unit: dive, high-angle, MVC, marine and air rescue, plus patrol duty.",
  "submitLabel": "Submit CRU Report",
  "color": "#f97316",
  "embedTitle": "🛟 LSPD CRU Incident Report — {cruNo}",
  "threadTitle": "{cruNo} | {cruType}",
  "archiveSheet": "CRU Incidents",
  "hours": {
   "on": true,
   "dateField": "cruDate",
   "startField": "cruStart",
   "endField": "cruEnd",
   "people": [
    "cruLead",
    "cruMembers"
   ]
  },
  "blocks": [
   {
    "type": "banner",
    "title": "LSPD - CRISIS RESPONSE UNIT (CRU) INCIDENT REPORT",
    "subtitle": "Technical rescue: dive, high-angle, MVC, marine and air rescue, and patrol duty."
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "cruNo",
      "label": "Incident #:",
      "type": "case_number",
      "prefix": "CRU",
      "required": true
     },
     {
      "id": "cruCad",
      "label": "CAD Case #:",
      "type": "text"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "cruLead",
      "label": "Lead / Incident Commander:",
      "type": "officer",
      "required": true,
      "rosterTabName": "CRU - Roster"
     },
     {
      "id": "cruMembers",
      "label": "CRU Members:",
      "type": "officers",
      "rosterTabName": "CRU - Roster"
     }
    ]
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "cruType",
      "label": "Incident Type",
      "type": "select",
      "required": true,
      "options": [
       "Dive Rescue",
       "High-Angle Rescue",
       "MVC / Extrication",
       "Marine Response",
       "Air Rescue",
       "Air Unit Support",
       "Patrol Duty",
       "Other"
      ]
     },
     {
      "id": "cruDate",
      "label": "Date",
      "type": "date",
      "defaultToday": true
     },
     {
      "id": "cruStart",
      "label": "Start",
      "type": "time",
      "required": true
     },
     {
      "id": "cruEnd",
      "label": "End",
      "type": "time",
      "required": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "cruLocation",
      "label": "Location / Postal:",
      "type": "text",
      "placeholder": "Postal 388"
     },
     {
      "id": "cruOutcome",
      "label": "Outcome:",
      "type": "select",
      "required": true,
      "options": [
       "Rescued",
       "Recovered",
       "Transported to EMS",
       "Treated on Scene",
       "Unable to Locate",
       "Handed Off",
       "Patrol (no incident)"
      ]
     }
    ]
   },
   {
    "type": "checklist",
    "id": "cruEquipment",
    "title": "EQUIPMENT USED",
    "display": "selected",
    "colTopic": "Equipment",
    "colStandard": "",
    "colCheck": "Used",
    "items": [
     {
      "topic": "Rope System",
      "standard": ""
     },
     {
      "topic": "Dive Gear",
      "standard": ""
     },
     {
      "topic": "Boat",
      "standard": ""
     },
     {
      "topic": "Extrication Tools",
      "standard": ""
     },
     {
      "topic": "Drone",
      "standard": ""
     },
     {
      "topic": "Helicopter Hoist",
      "standard": ""
     },
     {
      "topic": "Medical Kit",
      "standard": ""
     }
    ]
   },
   {
    "type": "repeater",
    "id": "cruCharges",
    "title": "CHARGES",
    "addLabel": "+ Add Charge",
    "groupBy": "suspect",
    "totals": {
     "on": true,
     "col": "charge",
     "countCol": "count"
    },
    "columns": [
     {
      "id": "suspect",
      "label": "Suspect",
      "type": "text",
      "placeholder": "Name"
     },
     {
      "id": "charge",
      "label": "Charge (type to search)",
      "type": "search",
      "options": [
       "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violating boating safety regulations (Misdemeanor, 4 Months - $1,000 Fine)",
       "No Wake Zone (Misdemeanor, $1,750 Fine)",
       "Operating a vessel without the proper registration (Infraction, $250 Fine)",
       "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
       "Driving Without a Commercial Driver's License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Submit Vehicle to Inspection (Misdemeanor, 4 Months - $2,250 Fine)",
       "Overweight Vehicle (Infraction, $250 Fine)",
       "Defective Equipment (Infraction, $250 Fine)",
       "Inadequate Safety Inspections (Infraction, $250 Fine)",
       "Failure to Maintain Logbooks (Infraction, $250 Fine)",
       "Improper Transport of Hazardous Materials (Infraction, $250 Fine)",
       "Failure to Carry Proper Documentation (Infraction, $250 Fine)",
       "Driving Without Proper Permits (Infraction, $250 Fine)",
       "Hours of Service Violation (Infraction, $250 Fine)",
       "Medical Certificate Violation (Infraction, $250 Fine)",
       "Improper Load Securement (Infraction, $250 Fine)",
       "Online Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Phishing (Felony, 7 Months - $3,000 Fine)",
       "Unauthorized Access to Computer Systems (Felony, 7 Months - $3,000 Fine)",
       "Possession of Controlled Substances (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
       "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Driving Under Drug Influence (Felony, 7 Months - $3,000 Fine)",
       "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
       "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
       "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
       "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
       "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
       "Public Sale of Drugs (Felony, 7 Months - $3,000 Fine)",
       "Possession of Drug Paraphernalia (Felony, 7 Months - $3,000 Fine)",
       "Illegal Dumping (Misdemeanor, 4 Months - $1,000 Fine)",
       "Overfishing (Infraction, $250 Fine)",
       "Illegal Logging (Felony, 7 Months - $3,000 Fine)",
       "Endangered Species Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Illegal Mining (Felony, 7 Months - $3,000 Fine)",
       "Poaching (Felony, 7 Months - $3,000 Fine)",
       "Careless or Reckless Aircraft Operation (Misdemeanor, 5 Months - $1,000 Fine)",
       "Operating Without a Pilot Certificate (Misdemeanor, 5 Months - $1,000 Fine)",
       "Consuming Personal Alcohol Aboard an Aircraft (Misdemeanor, 5 Months - $2,500 Fine)",
       "Boarding While Intoxicated (Misdemeanor, 5 Months - $1,500 Fine)",
       "Undeclared Hazardous Materials (Misdemeanor, 5 Months - $1,000 Fine)",
       "Falsification of FAA Records (Felony, 10 Months - $2,500 Fine)",
       "Violation of a Temporary Flight Restriction (Felony, 5 Months - $3,500 Fine)",
       "Operating an Aircraft to Facilitate Drug Trafficking (Felony, 20 Months - $5,000 Fine)",
       "Assault Aboard an Aircraft (Felony, 15 Months - $2,500 Fine)",
       "Carrying a Weapon Aboard an Aircraft (Felony, 15 Months - $5,000 Fine)",
       "Carrying an Explosive or Incendiary Device Aboard (Felony, 20 Months - $5,000 Fine)",
       "Aircraft Hijacking (Felony, 20 Months - $5,000 Fine)",
       "Criminal Transportation of Hazardous Materials (Felony, 15 Months - $2,500 Fine)",
       "Failure to Declare an Item (Misdemeanor, 5 Months - $1,000 Fine)",
       "Importing Prohibited Agricultural Items (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare a Firearm (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare Prescription Medication (Misdemeanor, 5 Months - $1,000 Fine)",
       "Improper Entry (Felony, 15 Months - $5,000 Fine)",
       "Illegal Re-entry (Felony, 20 Months - $5,000 Fine)",
       "Alien Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Attempted Human Smuggling (Felony, 15 Months - $2,500 Fine)",
       "Conspiracy to Commit Human Trafficking (Felony, 15 Months - $5,000 Fine)",
       "Visa or Immigration-Document Fraud (Felony, 15 Months - $5,000 Fine)",
       "Unlawful Transportation (Felony, 15 Months - $2,500 Fine)",
       "Bringing a Person Through an Unauthorized Location (Felony, 15 Months - $3,500 Fine)",
       "Passport Forgery or False Use (Felony, 15 Months - $2,500 Fine)",
       "High-Speed Flight From an Immigration Checkpoint (Felony, 10 Months - $2,500 Fine)",
       "Forcibly Resisting or Impeding a Federal Agent (Felony, 10 Months - $500 Fine)",
       "Aggravated Assault on a Federal Agent (Felony, 15 Months - $2,000 Fine)",
       "False Statements to a Federal Agent (Felony, 5 Months - $500 Fine)",
       "Possession of Contraband at a Checkpoint (Felony, 10 Months - $1,000 Fine)",
       "Alien Smuggling Discovered at a Checkpoint (Felony, 15 Months - $2,000 Fine)",
       "False Customs Declaration (Felony, 10 Months - $2,500 Fine)",
       "Smuggling Goods Into the United States (Felony, 10 Months - $1,000 Fine)",
       "Undeclared Currency or Monetary Instruments (Felony, 15 Months - $2,000 Fine)",
       "Illegal Importation of a Firearm (Felony, 7 Months - $1,000 Fine)",
       "Firearm Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Drug Smuggling Through Concealment (Felony, 20 Months - $5,000 Fine)",
       "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Arrest (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
       "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violation Of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
       "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
       "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
       "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sightseeing at the Scene of an Emergency (Misdemeanor, 6 Months - $1,200 Fine)",
       "Unlawful Assembly (Infraction, $250 Fine)",
       "Littering (Infraction, $250 Fine)",
       "Perjury (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
       "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
       "Aiding and Abetting (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Peace Officer (Felony, 7 Months - $3,000 Fine)",
       "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
       "Marked Bills (Felony, 9 Months - $3,000 Fine)",
       "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
       "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
       "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
       "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
       "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
       "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
       "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
       "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Trespassing (Infraction, $250 Fine)",
       "Burglary (Felony, 11 Months - $6,000 Fine)",
       "Arson (Felony, 14 Months - $10,000 Fine)",
       "Credit Card Fraud (Felony, 5 Months - $3,000 Fine)",
       "Breaking and Entering (Felony, 5 Months - $3,000 Fine)",
       "Identity Theft (Felony, 5 Months - $3,000 Fine)",
       "Theft of Public Property (Felony, 5 Months - $3,000 Fine)",
       "Extortion (Felony, 5 Months - $3,000 Fine)",
       "Attempted Robbery (Felony, 8 Months - $3,000 Fine)",
       "Disorderly Conduct (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Intoxication (Misdemeanor, 4 Months - $1,000 Fine)",
       "Indecent Exposure (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Mischief (Misdemeanor, 4 Months - $1,000 Fine)",
       "Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Aiding & Abetting (Misdemeanor) (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Identify (Misdemeanor, 4 Months - $1,000 Fine)",
       "Loitering (Infraction, $250 Fine)",
       "Disturbing the Peace (Infraction, $250 Fine)",
       "Illegal Protests (Infraction, $250 Fine)",
       "Rioting (Felony, 7 Months - $3,000 Fine)",
       "Bribery (Felony, 7 Months - $3,000 Fine)",
       "Inciting a Riot (Felony, 7 Months - $3,000 Fine)",
       "Illegal Immigration (Felony, 7 Months - $3,000 Fine)",
       "Reckless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Driving Without a License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Road Rage Incident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Attempted Grand Theft Auto (Misdemeanor, 7 Months - $3,000 Fine)",
       "Leaving the Scene of a Vehicle Accident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Careless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Operating a Vehicle with Suspended License (Misdemeanor)",
       "Driving a Motorcycle Without a Motorcycle License (Misdemeanor, $500 Fine)",
       "Speeding (Infraction, $250 Fine)",
       "Running a Red Light (Infraction, $250 Fine)",
       "Driving Without Insurance (Infraction, $250 Fine)",
       "Failure to Yield (Infraction, $250 Fine)",
       "Illegal U-Turn (Infraction, $250 Fine)",
       "Driving Without Headlights (Infraction, $250 Fine)",
       "Driving in the Wrong Direction (Infraction, $250 Fine)",
       "Illegal Parking in Handicap Zones (Infraction, $250 Fine)",
       "Excessive Window Tinting (Infraction, $250 Fine)",
       "Failure to Maintain Lanes (Infraction, $250 Fine)",
       "Unsafe Passing (Infraction, $250 Fine)",
       "Failure to Yield to an Emergency Vehicle (Infraction, $250 Fine)",
       "Obstructed License Plate (Infraction, $250 Fine)",
       "Unsafe Hauling (Infraction, $250 Fine)",
       "Parking in a Fire Zone (Infraction, $250 Fine)",
       "Failure to Yield to a Traffic Device (Infraction, $250 Fine)",
       "Improper Vehicle Safety Equipment (Infraction, $250 Fine)",
       "Operating an Unroadworthy Vehicle on a Public Roadway (Infraction, $250 Fine)",
       "Lighting Violation (Infraction, $250 Fine)",
       "Improper Parking, Stopping, or Standing (Infraction, $250 Fine)",
       "Unsafe Lane Changes (Infraction, $250 Fine)",
       "Operating a Motorcycle Without a Helmet (Infraction, $250 Fine)",
       "Impeding Traffic (Infraction, $250 Fine)",
       "Using a Handheld Device While Driving (Infraction, $250 Fine)",
       "Improper Use of Horn (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrian in Crosswalk (Infraction, $250 Fine)",
       "Crossing a Double Yellow Line (Infraction, $250 Fine)",
       "Passing on the Shoulder (Infraction, $250 Fine)",
       "Towing Without a License (Infraction, $500 Fine)",
       "Move Over Law (Infraction, $250 Fine)",
       "Illegally Parked in a No Parking Zone (Infraction, $250 Fine)",
       "Failure to Pay for Parking Meter (Infraction, $250 Fine)",
       "Blocking a Driveway (Infraction, $250 Fine)",
       "Blocking a Crosswalk (Infraction, $250 Fine)",
       "Facing the Wrong Way (Infraction, $250 Fine)",
       "Bus Stop Violation (Infraction, $250 Fine)",
       "Blocking an Intersection (Infraction, $250 Fine)",
       "Parking Within 15 Feet of a Fire Station Driveway (Infraction, $250 Fine)",
       "Blocking Railroad Crossing (Infraction, $250 Fine)",
       "Parking on a Sidewalk Median or Divider (Infraction, $250 Fine)",
       "Unregistered Vehicle (Infraction, $250 Fine)",
       "Towing Without a Valid Operator's License (Infraction, $500 Fine)",
       "Failure to Signal (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrians (Infraction, $250 Fine)",
       "Blocking Emergency Access Lanes (Infraction, $250 Fine)",
       "Expired Insurance (Infraction, $250 Fine)",
       "Fictitious Plate (Infraction, $250 Fine)",
       "Prohibited Underglow Lighting (Infraction, $250 Fine)",
       "Tailgating (Infraction, $250 Fine)",
       "Plate Violation (Infraction, $250 Fine)",
       "Operating a Vehicle While Using a Miscellaneous Object (Infraction, $500 Fine)",
       "Occupying a Side of the Freeway (Infraction, $250 Fine)",
       "Parking in an Alley Way (Infraction, $250 Fine)",
       "Unlawful Riding in a Vehicle (Infraction, $500 Fine)",
       "Driving Under the Influence (DUI) (Felony, 7 Months - $3,000 Fine)",
       "Hit and Run (Felony, 7 Months - $3,000 Fine)",
       "Street Racing (Felony, 7 Months - $3,000 Fine)",
       "Fleeing/Attempting to Elude (Felony, 7 Months - $3,000 Fine)",
       "Possession of a Stolen Vehicle (Felony, 7 Months - $3,000 Fine)",
       "Felony Speeding (Felony, 9 Months - $6,000 Fine)",
       "Grand Theft Auto (Felony, 7 Months - $6,000 Fine)",
       "Assault (Misdemeanor, 7 Months - $3,000 Fine)",
       "Battery (Misdemeanor, 7 Months - $3,000 Fine)",
       "Reckless Endangerment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Stalking (Misdemeanor, 7 Months - $3,000 Fine)",
       "Robbery (Felony, 15 Months - $6,000 Fine)",
       "Homicide (Felony, 18 Months - $10,000 Fine)",
       "Domestic Violence (Felony, 15 Months - $6,000 Fine)",
       "Kidnapping (Felony, 18 Months - $10,000 Fine)",
       "Aggravated Assault (Felony, 18 Months - $10,000 Fine)",
       "Terroristic Threats (Felony, 7 Months - $3,000 Fine)",
       "Vehicular Manslaughter (Felony, 18 Months - $10,000 Fine)",
       "Attempted Murder of a Government Official (Felony, 18 Months - $6,000 Fine)",
       "Brandishing a Firearm in Public (Felony, 15 Months - $6,000 Fine)",
       "Assault of a Peace Officer (Felony, 15 Months - $6,000 Fine)",
       "Attempted Murder (Felony, 18 Months - $10,000 Fine)",
       "Armed Robbery (Felony, 18 Months - $9,000 Fine)",
       "Aggravated Battery (Felony, 15 Months - $6,000 Fine)",
       "Battery on a Law Enforcement Officer (Felony, 15 Months - $6,000 Fine)",
       "Second-Degree Murder (Felony, 15 Months - $6,000 Fine)",
       "Capital Murder (Felony, 15 Months - $6,000 Fine)",
       "Carjacking (Felony, 15 Months - $6,000 Fine)",
       "Solicitation to Commit Murder (Felony, 9 Months - $10,000 Fine)",
       "Obstructing Justice (Felony, 7 Months - $3,000 Fine)",
       "Possession of Assault Weapon (Felony, 7 Months - $2,250 Fine)",
       "Brandishing a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Using a Weapon While Intoxicated (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Secure a Firearm (Misdemeanor, 7 Months - $3,000 Fine)",
       "Carrying a Loaded Firearm in Public (Misdemeanor, 7 Months - $3,000 Fine)",
       "Negligent Use of a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Possession of a Firearm Without a License (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Report Lost/Stolen Firearm (Misdemeanor, 4 Months - $1,000 Fine)",
       "Firearm in a Restricted Zone (Misdemeanor, 4 Months - $1,000 Fine)",
       "Carrying a Concealed Weapon Without Permit (Felony, 15 Months - $6,000 Fine)",
       "Illegal Sale of Firearms (Felony, 15 Months - $6,000 Fine)",
       "Unlawful Discharge of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Prohibited Weapon (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Weapon in a Restricted Area (Felony, 15 Months - $6,000 Fine)",
       "Trafficking Illegal Firearms (Felony, 15 Months - $6,000 Fine)",
       "Modifying a Firearm Illegally (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Firearm Without a Serial Number (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Stolen Firearm (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Open Carry (Felony, 7 Months - $3,000 Fine)",
       "Reckless Firearm Discharge (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of Deadly Weapon (Felony, 15 Months - $6,000 Fine)",
       "Discharge of a Firearm in City Limits (Felony, 15 Months - $6,000 Fine)",
       "Unserialized (\"Ghost\") Firearm (Felony, 15 Months - $6,000 Fine)",
       "Carrying Firearm While Masked (Felony, 15 Months - $6,000 Fine)",
       "Undetectable Firearm (Felony, 15 Months - $6,000 Fine)",
       "Sale to Prohibited Person (Felony, 15 Months - $6,000 Fine)",
       "Straw Purchase of Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of an Unregistered Firearm (Felony, 9 Months)",
       "Illegal Transfer of a Firearm (Felony, 12 Months - $6,000 Fine)",
       "Possession of Ammunition by a Felon (Felony, 9 Months - $4,000 Fine)",
       "Possession of Explosive Device(s) (Felony, 18 Months - $8,000 Fine)",
       "Carrying a Firearm While Being Underage (Felony, 9 Months - $2,000 Fine)",
       "Possession of a Weapon in Commission of a Crime (Felony, 12 Months - $6,000 Fine)",
       "Possession of an Illegal Firearm Modification (Felony, 12 Months - $1,200 Fine)",
       "Embezzlement (Felony, 11 Months - $6,000 Fine)",
       "Fraud (Felony, 5 Months - $3,000 Fine)",
       "Tax Evasion (Felony, 5 Months - $3,000 Fine)",
       "Money Laundering (Felony, 5 Months - $3,000 Fine)",
       "Insider Trading (Felony, 5 Months - $3,000 Fine)",
       "Forgery (Felony, 5 Months - $3,000 Fine)",
       "Cybercrime (Felony, 5 Months - $3,000 Fine)",
       "Healthcare Fraud (Felony, 5 Months - $3,000 Fine)",
       "Ponzi Scheme (Felony, 5 Months - $3,000 Fine)",
       "Counterfeiting (Felony, 5 Months - $3,000 Fine)",
       "Corporate Espionage (Felony, 5 Months - $3,000 Fine)",
       "Animal Abuse and Cruelty (Misdemeanor, 4 Months - $1,000 Fine)",
       "Possession of Illegally Taken Wildlife (Misdemeanor, 4 Months - $1,000 Fine)",
       "Importation of Restricted Animals (Misdemeanor, 4 Months - $1,000 Fine)",
       "Exceeding Daily Catch Limits (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Out of Season or in Protected Areas (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sale of Illegally Taken Fish (Misdemeanor, 4 Months - $1,000 Fine)",
       "Endangered Species Violation (Misdemeanor, 4 Months - $1,000 Fine)",
       "Using Illegal Fishing Gear or Methods (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Without a License (Infraction, $250 Fine)"
      ],
      "placeholder": "Start typing, e.g. robbery"
     },
     {
      "id": "count",
      "label": "Counts",
      "type": "text",
      "placeholder": "1",
      "width": "narrow"
     }
    ],
    "check": {
     "id": "warrant",
     "label": "Warrant Req."
    }
   },
   {
    "type": "longtext",
    "id": "cruNarrative",
    "title": "NARRATIVE",
    "hint": "What happened, what the team did, and how it ended.",
    "maxLength": 8000,
    "required": true,
    "followUp": true,
    "guide": {
     "on": true,
     "steps": [
      {
       "label": "Call-out",
       "help": "How were you called, when, and to where?",
       "starter": "On {cruDate} at approximately {cruStart} hours, CRU was requested to {cruLocation} for a {cruType}."
      },
      {
       "label": "Arrival & size-up",
       "help": "What did you find? Hazards, number of victims.",
       "starter": "Upon arrival, I observed [scene, hazards, victims]."
      },
      {
       "label": "Rescue operation",
       "help": "What did the team do, with which equipment?",
       "starter": "The team [set up / deployed] [equipment] and [actions taken]."
      },
      {
       "label": "Outcome",
       "help": "How did it end? Who took over care?",
       "starter": "The incident ended with {cruOutcome} at approximately {cruEnd} hours."
      }
     ],
     "tips": [
      "Write in first person and past tense: \"I observed\", not \"Officer observed\".",
      "Tell it in the order it happened, with times (e.g. 2315 hours).",
      "Stick to facts you saw, heard or were told.",
      "Quote important statements word for word.",
      "Re-read it once: would someone who wasn't there understand what happened?"
     ],
     "mention": [],
     "keywords": []
    }
   }
  ]
 },
 {
  "theme": "hud",
  "status": "hidden",
  "copyText": true,
  "webhookId": "",
  "watermarkMode": "single",
  "tags": {
   "base": [],
   "rules": []
  },
  "leaderboard": {
   "enabled": false,
   "countField": "",
   "webhookId": "",
   "messageId": "",
   "title": "",
   "heading": ""
  },
  "id": "suptask",
  "section": "Training",
  "logoUrl": "img/lspd-badge.png",
  "discordThumb": "https://raw.githubusercontent.com/Izzy24249/lspd-portal/main/site/img/lspd-badge.png",
  "icon": "🎖️",
  "title": "Supervisor Training Log",
  "description": "Log a Corporal's SGT requirement: GOM trainings, 71 requests and the supervisor ride-along.",
  "submitLabel": "Log Requirement",
  "color": "#f2b632",
  "embedTitle": "🎖️ Supervisor Training Log — {stNo}",
  "threadTitle": "{stCpl} | {stTask}",
  "archiveSheet": "Supervisor Training",
  "blocks": [
   {
    "type": "banner",
    "title": "LSPD - SUPERVISOR TRAINING LOG",
    "subtitle": "Corporal → Sergeant requirements. Filing this updates the SGT Promotion Tracker automatically."
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "stNo",
      "label": "Log #:",
      "type": "case_number",
      "prefix": "SUP",
      "required": true
     },
     {
      "id": "stDate",
      "label": "Date:",
      "type": "date",
      "defaultToday": true,
      "required": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "stCpl",
      "label": "Corporal (CPL):",
      "type": "officer",
      "required": true,
      "rosterTabName": "FTO - Roster"
     },
     {
      "id": "stTask",
      "label": "Requirement completed:",
      "type": "select",
      "required": true,
      "options": [
       "Witness a Global Operation Manual Training",
       "Lead a GOM Training with a SGT+ hosting",
       "Complete a GOM Training on their own",
       "Witness a SGT+ handle a 71 request",
       "Supervisor Ride-Along with a SGM+"
      ]
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "stSupervisor",
      "label": "Supervising SGT+ / SGM+:",
      "type": "officer",
      "required": true
     },
     {
      "id": "stOthers",
      "label": "Trainees / others present:",
      "type": "officers",
      "allowTyped": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "stLocation",
      "label": "Location / Postal:",
      "type": "text",
      "placeholder": "Mission Row PD"
     },
     {
      "id": "stCad",
      "label": "CAD # (71 request / RA):",
      "type": "text"
     }
    ]
   },
   {
    "type": "longtext",
    "id": "stNotes",
    "title": "SUMMARY",
    "hint": "What happened and how the CPL did.",
    "maxLength": 4000,
    "required": true,
    "followUp": true,
    "guide": {
     "on": true,
     "steps": [
      {
       "label": "What",
       "help": "Which requirement, when and where?",
       "starter": "On {stDate}, {stCpl} completed: {stTask}."
      },
      {
       "label": "Who",
       "help": "Who supervised or hosted, and who else was there?",
       "starter": "The session was supervised by {stSupervisor}."
      },
      {
       "label": "How it went",
       "help": "Strengths and anything to work on.",
       "starter": "The CPL [performed well / needs to improve] in [areas]."
      }
     ],
     "tips": [
      "Write in first person and past tense: \"I observed\", not \"Officer observed\".",
      "Tell it in the order it happened, with times (e.g. 2315 hours).",
      "Stick to facts you saw, heard or were told.",
      "Quote important statements word for word.",
      "Re-read it once: would someone who wasn't there understand what happened?"
     ],
     "mention": [],
     "keywords": []
    }
   }
  ]
 },
 {
  "theme": "hud",
  "status": "hidden",
  "copyText": true,
  "webhookId": "",
  "watermarkMode": "single",
  "tags": {
   "base": [],
   "rules": []
  },
  "leaderboard": {
   "enabled": false,
   "countField": "",
   "webhookId": "",
   "messageId": "",
   "title": "",
   "heading": ""
  },
  "id": "bpalog",
  "section": "Training",
  "logoUrl": "img/lspd-badge.png",
  "discordThumb": "https://raw.githubusercontent.com/Izzy24249/lspd-portal/main/site/img/lspd-badge.png",
  "icon": "🎯",
  "title": "Basic Training (BPA) Log",
  "description": "Log an onboarding officer's Basic Training (BPA). A pass checks it off on the Onboarding page.",
  "submitLabel": "Log Basic Training",
  "color": "#22c55e",
  "embedTitle": "🎯 Basic Training (BPA) — {bpNo}",
  "threadTitle": "{bpTrainee} | BPA {bpResult}",
  "archiveSheet": "Basic Training Log",
  "blocks": [
   {
    "type": "banner",
    "title": "LSPD - BASIC TRAINING (BPA) LOG",
    "subtitle": "Onboarding requirement. A passed log updates the Onboarding progression page automatically."
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "bpNo",
      "label": "Log #:",
      "type": "case_number",
      "prefix": "BPA",
      "required": true
     },
     {
      "id": "bpDate",
      "label": "Date:",
      "type": "date",
      "defaultToday": true,
      "required": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "bpTrainee",
      "label": "Onboarding officer:",
      "type": "officer",
      "required": true,
      "rosterTabName": "Onboarding",
      "allowTyped": true
     },
     {
      "id": "bpInstructor",
      "label": "Instructor:",
      "type": "officer",
      "required": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "bpResult",
      "label": "Result:",
      "type": "select",
      "required": true,
      "options": [
       "Passed",
       "Needs retake"
      ]
     },
     {
      "id": "bpLocation",
      "label": "Location:",
      "type": "text",
      "placeholder": "Mission Row PD"
     }
    ]
   },
   {
    "type": "longtext",
    "id": "bpNotes",
    "title": "NOTES",
    "hint": "How they did, and anything to work on.",
    "maxLength": 3000,
    "required": false,
    "followUp": true
   }
  ]
 },
 {
  "theme": "teu",
  "status": "hidden",
  "copyText": true,
  "preview": true,
  "previewType": "teuType",
  "textUpper": true,
  "textHeader": "{teuOfficer} | {teuBadge} | {teuType} | {teuDate} | {teuDept}",
  "webhookId": "",
  "watermarkMode": "single",
  "tags": {
   "base": [],
   "rules": []
  },
  "leaderboard": {
   "enabled": false,
   "countField": "",
   "webhookId": "",
   "messageId": "",
   "title": "",
   "heading": ""
  },
  "id": "teu",
  "section": "Division reports",
  "icon": "🚦",
  "title": "TEU Field Report",
  "description": "Traffic Enforcement Unit: traffic stops, impounds, pursuits, DUI, CVE inspections, incidents and bicycle patrol.",
  "submitLabel": "Submit TEU Report",
  "color": "#84cc16",
  "embedTitle": "🚦 TEU · {teuType}",
  "threadTitle": "{teuType} | {teuOfficer}",
  "archiveSheet": "TEU Reports",
  "discordStyle": "",
  "discordEmoji": false,
  "cidApp": false,
  "forumTagOptions": [],
  "hours": {
   "on": false,
   "dateField": "",
   "startField": "",
   "endField": "",
   "people": []
  },
  "blocks": [
   {
    "type": "banner",
    "title": "TEU :: REPORTS",
    "subtitle": "Field Report Builder · Traffic Enforcement Unit"
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "teuType",
      "label": "Report Type",
      "type": "select",
      "options": [
       "Traffic Stop Report",
       "Vehicle Impound Report",
       "Vehicle Pursuit Report",
       "DUI Investigation Report",
       "CVE Inspection Report",
       "Incident Report (Non-Arrest)",
       "Bicycle Patrol Unit Report"
      ],
      "required": true,
      "default": "Traffic Stop Report"
     }
    ]
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "teuRank",
      "label": "Rank",
      "type": "select",
      "options": [
       "TEU Command",
       "TEU FTO",
       "TEU Senior Officer",
       "TEU Officer II",
       "TEU Officer",
       "TEU Probationary Officer",
       "Honorary TEU Officer"
      ],
      "default": "TEU Officer"
     },
     {
      "id": "teuBadge",
      "label": "Badge #",
      "type": "text",
      "placeholder": "L-108"
     },
     {
      "id": "teuDept",
      "label": "Dept",
      "type": "select",
      "options": [
       "LSPD",
       "BCSO",
       "SAHP"
      ],
      "default": "LSPD"
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "teuOfficer",
      "label": "Officer Name",
      "type": "officer",
      "required": true
     },
     {
      "id": "teuUnits",
      "label": "Assisting Units",
      "type": "officers",
      "allowTyped": true
     }
    ]
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "teuDate",
      "label": "Date",
      "type": "date",
      "defaultToday": true
     },
     {
      "id": "teuTime",
      "label": "Time",
      "type": "time"
     },
     {
      "id": "teuLoc",
      "label": "Location",
      "type": "text",
      "placeholder": "Strawberry Avenue",
      "required": true
     }
    ]
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "teuWeather",
      "label": "Weather Conditions",
      "type": "select",
      "options": [
       "Clear",
       "Cloudy",
       "Rain",
       "Fog",
       "Storm",
       "Snow"
      ],
      "blank": true
     },
     {
      "id": "teuRoad",
      "label": "Road Conditions",
      "type": "select",
      "options": [
       "Dry",
       "Wet",
       "Icy",
       "Flooded",
       "Under Construction"
      ],
      "blank": true
     }
    ]
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Driver Information",
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "tsName",
      "label": "Full Name",
      "type": "text",
      "placeholder": "Phil Cantoon",
      "required": true
     },
     {
      "id": "tsId",
      "label": "State ID / DL #",
      "type": "text",
      "placeholder": "SA-1029384"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "tsDob",
      "label": "Date of Birth",
      "type": "date"
     },
     {
      "id": "tsAddr",
      "label": "Address",
      "type": "text",
      "placeholder": "14 Alta Street"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "tsLic",
      "label": "License Status",
      "type": "select",
      "options": [
       "Valid",
       "Suspended",
       "Revoked"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Vehicle Information",
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "tsMake",
      "label": "Make",
      "type": "text",
      "placeholder": "Bravado"
     },
     {
      "id": "tsModel",
      "label": "Model",
      "type": "text",
      "placeholder": "Buffalo"
     },
     {
      "id": "tsColor",
      "label": "Color",
      "type": "select",
      "options": [
       "White",
       "Black",
       "Silver",
       "Gray",
       "Red",
       "Blue",
       "Green",
       "Yellow",
       "Orange",
       "Brown",
       "Beige",
       "Gold",
       "Purple",
       "Maroon"
      ],
      "blank": true
     },
     {
      "id": "tsPlate",
      "label": "Plate Number",
      "type": "text",
      "placeholder": "6ABC123"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "tsReg",
      "label": "Registration Status",
      "type": "select",
      "options": [
       "Valid",
       "Expired",
       "Stolen"
      ],
      "blank": true
     },
     {
      "id": "tsReason",
      "label": "Reason for Stop",
      "type": "select",
      "options": [
       "Speeding",
       "Reckless Driving",
       "Failure to Stop",
       "Red Light Violation",
       "Illegal U-Turn",
       "Expired Registration",
       "Equipment Violation",
       "Suspended License",
       "Other"
      ],
      "required": true,
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Radar / Lidar Details (if applicable)",
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "tsPosted",
      "label": "Posted Speed Limit",
      "type": "text",
      "placeholder": "50"
     },
     {
      "id": "tsRecorded",
      "label": "Recorded Speed",
      "type": "text",
      "placeholder": "74"
     },
     {
      "id": "tsDevice",
      "label": "Device Used",
      "type": "text",
      "placeholder": "Radar gun"
     },
     {
      "id": "tsCal",
      "label": "Calibration Status",
      "type": "text",
      "placeholder": "Current"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "longtext",
    "id": "tsObs",
    "title": "OFFICER OBSERVATIONS",
    "maxLength": 2000,
    "hint": "Driving behavior, demeanor, any admissions.",
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "tsAction",
      "label": "Action Taken",
      "type": "select",
      "options": [
       "Verbal Warning",
       "Written Warning",
       "Citation Issued",
       "Vehicle Impounded",
       "Arrest Made"
      ],
      "required": true,
      "blank": true
     },
     {
      "id": "tsFine",
      "label": "Fine Amount",
      "type": "text",
      "placeholder": "$250"
     },
     {
      "id": "tsPoints",
      "label": "Points Assigned",
      "type": "text",
      "placeholder": "2"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "repeater",
    "id": "tsCharges",
    "title": "CHARGES / CITATIONS",
    "addLabel": "+ Add Charge",
    "totals": {
     "on": true,
     "col": "charge",
     "countCol": "count"
    },
    "columns": [
     {
      "id": "charge",
      "label": "Charge (type to search)",
      "type": "search",
      "options": [
       "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violating boating safety regulations (Misdemeanor, 4 Months - $1,000 Fine)",
       "No Wake Zone (Misdemeanor, $1,750 Fine)",
       "Operating a vessel without the proper registration (Infraction, $250 Fine)",
       "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
       "Driving Without a Commercial Driver's License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Submit Vehicle to Inspection (Misdemeanor, 4 Months - $2,250 Fine)",
       "Overweight Vehicle (Infraction, $250 Fine)",
       "Defective Equipment (Infraction, $250 Fine)",
       "Inadequate Safety Inspections (Infraction, $250 Fine)",
       "Failure to Maintain Logbooks (Infraction, $250 Fine)",
       "Improper Transport of Hazardous Materials (Infraction, $250 Fine)",
       "Failure to Carry Proper Documentation (Infraction, $250 Fine)",
       "Driving Without Proper Permits (Infraction, $250 Fine)",
       "Hours of Service Violation (Infraction, $250 Fine)",
       "Medical Certificate Violation (Infraction, $250 Fine)",
       "Improper Load Securement (Infraction, $250 Fine)",
       "Online Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Phishing (Felony, 7 Months - $3,000 Fine)",
       "Unauthorized Access to Computer Systems (Felony, 7 Months - $3,000 Fine)",
       "Possession of Controlled Substances (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
       "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Driving Under Drug Influence (Felony, 7 Months - $3,000 Fine)",
       "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
       "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
       "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
       "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
       "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
       "Public Sale of Drugs (Felony, 7 Months - $3,000 Fine)",
       "Possession of Drug Paraphernalia (Felony, 7 Months - $3,000 Fine)",
       "Illegal Dumping (Misdemeanor, 4 Months - $1,000 Fine)",
       "Overfishing (Infraction, $250 Fine)",
       "Illegal Logging (Felony, 7 Months - $3,000 Fine)",
       "Endangered Species Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Illegal Mining (Felony, 7 Months - $3,000 Fine)",
       "Poaching (Felony, 7 Months - $3,000 Fine)",
       "Careless or Reckless Aircraft Operation (Misdemeanor, 5 Months - $1,000 Fine)",
       "Operating Without a Pilot Certificate (Misdemeanor, 5 Months - $1,000 Fine)",
       "Consuming Personal Alcohol Aboard an Aircraft (Misdemeanor, 5 Months - $2,500 Fine)",
       "Boarding While Intoxicated (Misdemeanor, 5 Months - $1,500 Fine)",
       "Undeclared Hazardous Materials (Misdemeanor, 5 Months - $1,000 Fine)",
       "Falsification of FAA Records (Felony, 10 Months - $2,500 Fine)",
       "Violation of a Temporary Flight Restriction (Felony, 5 Months - $3,500 Fine)",
       "Operating an Aircraft to Facilitate Drug Trafficking (Felony, 20 Months - $5,000 Fine)",
       "Assault Aboard an Aircraft (Felony, 15 Months - $2,500 Fine)",
       "Carrying a Weapon Aboard an Aircraft (Felony, 15 Months - $5,000 Fine)",
       "Carrying an Explosive or Incendiary Device Aboard (Felony, 20 Months - $5,000 Fine)",
       "Aircraft Hijacking (Felony, 20 Months - $5,000 Fine)",
       "Criminal Transportation of Hazardous Materials (Felony, 15 Months - $2,500 Fine)",
       "Failure to Declare an Item (Misdemeanor, 5 Months - $1,000 Fine)",
       "Importing Prohibited Agricultural Items (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare a Firearm (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare Prescription Medication (Misdemeanor, 5 Months - $1,000 Fine)",
       "Improper Entry (Felony, 15 Months - $5,000 Fine)",
       "Illegal Re-entry (Felony, 20 Months - $5,000 Fine)",
       "Alien Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Attempted Human Smuggling (Felony, 15 Months - $2,500 Fine)",
       "Conspiracy to Commit Human Trafficking (Felony, 15 Months - $5,000 Fine)",
       "Visa or Immigration-Document Fraud (Felony, 15 Months - $5,000 Fine)",
       "Unlawful Transportation (Felony, 15 Months - $2,500 Fine)",
       "Bringing a Person Through an Unauthorized Location (Felony, 15 Months - $3,500 Fine)",
       "Passport Forgery or False Use (Felony, 15 Months - $2,500 Fine)",
       "High-Speed Flight From an Immigration Checkpoint (Felony, 10 Months - $2,500 Fine)",
       "Forcibly Resisting or Impeding a Federal Agent (Felony, 10 Months - $500 Fine)",
       "Aggravated Assault on a Federal Agent (Felony, 15 Months - $2,000 Fine)",
       "False Statements to a Federal Agent (Felony, 5 Months - $500 Fine)",
       "Possession of Contraband at a Checkpoint (Felony, 10 Months - $1,000 Fine)",
       "Alien Smuggling Discovered at a Checkpoint (Felony, 15 Months - $2,000 Fine)",
       "False Customs Declaration (Felony, 10 Months - $2,500 Fine)",
       "Smuggling Goods Into the United States (Felony, 10 Months - $1,000 Fine)",
       "Undeclared Currency or Monetary Instruments (Felony, 15 Months - $2,000 Fine)",
       "Illegal Importation of a Firearm (Felony, 7 Months - $1,000 Fine)",
       "Firearm Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Drug Smuggling Through Concealment (Felony, 20 Months - $5,000 Fine)",
       "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Arrest (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
       "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violation Of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
       "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
       "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
       "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sightseeing at the Scene of an Emergency (Misdemeanor, 6 Months - $1,200 Fine)",
       "Unlawful Assembly (Infraction, $250 Fine)",
       "Littering (Infraction, $250 Fine)",
       "Perjury (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
       "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
       "Aiding and Abetting (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Peace Officer (Felony, 7 Months - $3,000 Fine)",
       "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
       "Marked Bills (Felony, 9 Months - $3,000 Fine)",
       "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
       "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
       "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
       "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
       "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
       "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
       "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
       "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Trespassing (Infraction, $250 Fine)",
       "Burglary (Felony, 11 Months - $6,000 Fine)",
       "Arson (Felony, 14 Months - $10,000 Fine)",
       "Credit Card Fraud (Felony, 5 Months - $3,000 Fine)",
       "Breaking and Entering (Felony, 5 Months - $3,000 Fine)",
       "Identity Theft (Felony, 5 Months - $3,000 Fine)",
       "Theft of Public Property (Felony, 5 Months - $3,000 Fine)",
       "Extortion (Felony, 5 Months - $3,000 Fine)",
       "Attempted Robbery (Felony, 8 Months - $3,000 Fine)",
       "Disorderly Conduct (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Intoxication (Misdemeanor, 4 Months - $1,000 Fine)",
       "Indecent Exposure (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Mischief (Misdemeanor, 4 Months - $1,000 Fine)",
       "Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Aiding & Abetting (Misdemeanor) (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Identify (Misdemeanor, 4 Months - $1,000 Fine)",
       "Loitering (Infraction, $250 Fine)",
       "Disturbing the Peace (Infraction, $250 Fine)",
       "Illegal Protests (Infraction, $250 Fine)",
       "Rioting (Felony, 7 Months - $3,000 Fine)",
       "Bribery (Felony, 7 Months - $3,000 Fine)",
       "Inciting a Riot (Felony, 7 Months - $3,000 Fine)",
       "Illegal Immigration (Felony, 7 Months - $3,000 Fine)",
       "Reckless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Driving Without a License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Road Rage Incident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Attempted Grand Theft Auto (Misdemeanor, 7 Months - $3,000 Fine)",
       "Leaving the Scene of a Vehicle Accident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Careless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Operating a Vehicle with Suspended License (Misdemeanor)",
       "Driving a Motorcycle Without a Motorcycle License (Misdemeanor, $500 Fine)",
       "Speeding (Infraction, $250 Fine)",
       "Running a Red Light (Infraction, $250 Fine)",
       "Driving Without Insurance (Infraction, $250 Fine)",
       "Failure to Yield (Infraction, $250 Fine)",
       "Illegal U-Turn (Infraction, $250 Fine)",
       "Driving Without Headlights (Infraction, $250 Fine)",
       "Driving in the Wrong Direction (Infraction, $250 Fine)",
       "Illegal Parking in Handicap Zones (Infraction, $250 Fine)",
       "Excessive Window Tinting (Infraction, $250 Fine)",
       "Failure to Maintain Lanes (Infraction, $250 Fine)",
       "Unsafe Passing (Infraction, $250 Fine)",
       "Failure to Yield to an Emergency Vehicle (Infraction, $250 Fine)",
       "Obstructed License Plate (Infraction, $250 Fine)",
       "Unsafe Hauling (Infraction, $250 Fine)",
       "Parking in a Fire Zone (Infraction, $250 Fine)",
       "Failure to Yield to a Traffic Device (Infraction, $250 Fine)",
       "Improper Vehicle Safety Equipment (Infraction, $250 Fine)",
       "Operating an Unroadworthy Vehicle on a Public Roadway (Infraction, $250 Fine)",
       "Lighting Violation (Infraction, $250 Fine)",
       "Improper Parking, Stopping, or Standing (Infraction, $250 Fine)",
       "Unsafe Lane Changes (Infraction, $250 Fine)",
       "Operating a Motorcycle Without a Helmet (Infraction, $250 Fine)",
       "Impeding Traffic (Infraction, $250 Fine)",
       "Using a Handheld Device While Driving (Infraction, $250 Fine)",
       "Improper Use of Horn (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrian in Crosswalk (Infraction, $250 Fine)",
       "Crossing a Double Yellow Line (Infraction, $250 Fine)",
       "Passing on the Shoulder (Infraction, $250 Fine)",
       "Towing Without a License (Infraction, $500 Fine)",
       "Move Over Law (Infraction, $250 Fine)",
       "Illegally Parked in a No Parking Zone (Infraction, $250 Fine)",
       "Failure to Pay for Parking Meter (Infraction, $250 Fine)",
       "Blocking a Driveway (Infraction, $250 Fine)",
       "Blocking a Crosswalk (Infraction, $250 Fine)",
       "Facing the Wrong Way (Infraction, $250 Fine)",
       "Bus Stop Violation (Infraction, $250 Fine)",
       "Blocking an Intersection (Infraction, $250 Fine)",
       "Parking Within 15 Feet of a Fire Station Driveway (Infraction, $250 Fine)",
       "Blocking Railroad Crossing (Infraction, $250 Fine)",
       "Parking on a Sidewalk Median or Divider (Infraction, $250 Fine)",
       "Unregistered Vehicle (Infraction, $250 Fine)",
       "Towing Without a Valid Operator's License (Infraction, $500 Fine)",
       "Failure to Signal (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrians (Infraction, $250 Fine)",
       "Blocking Emergency Access Lanes (Infraction, $250 Fine)",
       "Expired Insurance (Infraction, $250 Fine)",
       "Fictitious Plate (Infraction, $250 Fine)",
       "Prohibited Underglow Lighting (Infraction, $250 Fine)",
       "Tailgating (Infraction, $250 Fine)",
       "Plate Violation (Infraction, $250 Fine)",
       "Operating a Vehicle While Using a Miscellaneous Object (Infraction, $500 Fine)",
       "Occupying a Side of the Freeway (Infraction, $250 Fine)",
       "Parking in an Alley Way (Infraction, $250 Fine)",
       "Unlawful Riding in a Vehicle (Infraction, $500 Fine)",
       "Driving Under the Influence (DUI) (Felony, 7 Months - $3,000 Fine)",
       "Hit and Run (Felony, 7 Months - $3,000 Fine)",
       "Street Racing (Felony, 7 Months - $3,000 Fine)",
       "Fleeing/Attempting to Elude (Felony, 7 Months - $3,000 Fine)",
       "Possession of a Stolen Vehicle (Felony, 7 Months - $3,000 Fine)",
       "Felony Speeding (Felony, 9 Months - $6,000 Fine)",
       "Grand Theft Auto (Felony, 7 Months - $6,000 Fine)",
       "Assault (Misdemeanor, 7 Months - $3,000 Fine)",
       "Battery (Misdemeanor, 7 Months - $3,000 Fine)",
       "Reckless Endangerment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Stalking (Misdemeanor, 7 Months - $3,000 Fine)",
       "Robbery (Felony, 15 Months - $6,000 Fine)",
       "Homicide (Felony, 18 Months - $10,000 Fine)",
       "Domestic Violence (Felony, 15 Months - $6,000 Fine)",
       "Kidnapping (Felony, 18 Months - $10,000 Fine)",
       "Aggravated Assault (Felony, 18 Months - $10,000 Fine)",
       "Terroristic Threats (Felony, 7 Months - $3,000 Fine)",
       "Vehicular Manslaughter (Felony, 18 Months - $10,000 Fine)",
       "Attempted Murder of a Government Official (Felony, 18 Months - $6,000 Fine)",
       "Brandishing a Firearm in Public (Felony, 15 Months - $6,000 Fine)",
       "Assault of a Peace Officer (Felony, 15 Months - $6,000 Fine)",
       "Attempted Murder (Felony, 18 Months - $10,000 Fine)",
       "Armed Robbery (Felony, 18 Months - $9,000 Fine)",
       "Aggravated Battery (Felony, 15 Months - $6,000 Fine)",
       "Battery on a Law Enforcement Officer (Felony, 15 Months - $6,000 Fine)",
       "Second-Degree Murder (Felony, 15 Months - $6,000 Fine)",
       "Capital Murder (Felony, 15 Months - $6,000 Fine)",
       "Carjacking (Felony, 15 Months - $6,000 Fine)",
       "Solicitation to Commit Murder (Felony, 9 Months - $10,000 Fine)",
       "Obstructing Justice (Felony, 7 Months - $3,000 Fine)",
       "Possession of Assault Weapon (Felony, 7 Months - $2,250 Fine)",
       "Brandishing a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Using a Weapon While Intoxicated (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Secure a Firearm (Misdemeanor, 7 Months - $3,000 Fine)",
       "Carrying a Loaded Firearm in Public (Misdemeanor, 7 Months - $3,000 Fine)",
       "Negligent Use of a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Possession of a Firearm Without a License (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Report Lost/Stolen Firearm (Misdemeanor, 4 Months - $1,000 Fine)",
       "Firearm in a Restricted Zone (Misdemeanor, 4 Months - $1,000 Fine)",
       "Carrying a Concealed Weapon Without Permit (Felony, 15 Months - $6,000 Fine)",
       "Illegal Sale of Firearms (Felony, 15 Months - $6,000 Fine)",
       "Unlawful Discharge of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Prohibited Weapon (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Weapon in a Restricted Area (Felony, 15 Months - $6,000 Fine)",
       "Trafficking Illegal Firearms (Felony, 15 Months - $6,000 Fine)",
       "Modifying a Firearm Illegally (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Firearm Without a Serial Number (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Stolen Firearm (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Open Carry (Felony, 7 Months - $3,000 Fine)",
       "Reckless Firearm Discharge (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of Deadly Weapon (Felony, 15 Months - $6,000 Fine)",
       "Discharge of a Firearm in City Limits (Felony, 15 Months - $6,000 Fine)",
       "Unserialized (\"Ghost\") Firearm (Felony, 15 Months - $6,000 Fine)",
       "Carrying Firearm While Masked (Felony, 15 Months - $6,000 Fine)",
       "Undetectable Firearm (Felony, 15 Months - $6,000 Fine)",
       "Sale to Prohibited Person (Felony, 15 Months - $6,000 Fine)",
       "Straw Purchase of Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of an Unregistered Firearm (Felony, 9 Months)",
       "Illegal Transfer of a Firearm (Felony, 12 Months - $6,000 Fine)",
       "Possession of Ammunition by a Felon (Felony, 9 Months - $4,000 Fine)",
       "Possession of Explosive Device(s) (Felony, 18 Months - $8,000 Fine)",
       "Carrying a Firearm While Being Underage (Felony, 9 Months - $2,000 Fine)",
       "Possession of a Weapon in Commission of a Crime (Felony, 12 Months - $6,000 Fine)",
       "Possession of an Illegal Firearm Modification (Felony, 12 Months - $1,200 Fine)",
       "Embezzlement (Felony, 11 Months - $6,000 Fine)",
       "Fraud (Felony, 5 Months - $3,000 Fine)",
       "Tax Evasion (Felony, 5 Months - $3,000 Fine)",
       "Money Laundering (Felony, 5 Months - $3,000 Fine)",
       "Insider Trading (Felony, 5 Months - $3,000 Fine)",
       "Forgery (Felony, 5 Months - $3,000 Fine)",
       "Cybercrime (Felony, 5 Months - $3,000 Fine)",
       "Healthcare Fraud (Felony, 5 Months - $3,000 Fine)",
       "Ponzi Scheme (Felony, 5 Months - $3,000 Fine)",
       "Counterfeiting (Felony, 5 Months - $3,000 Fine)",
       "Corporate Espionage (Felony, 5 Months - $3,000 Fine)",
       "Animal Abuse and Cruelty (Misdemeanor, 4 Months - $1,000 Fine)",
       "Possession of Illegally Taken Wildlife (Misdemeanor, 4 Months - $1,000 Fine)",
       "Importation of Restricted Animals (Misdemeanor, 4 Months - $1,000 Fine)",
       "Exceeding Daily Catch Limits (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Out of Season or in Protected Areas (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sale of Illegally Taken Fish (Misdemeanor, 4 Months - $1,000 Fine)",
       "Endangered Species Violation (Misdemeanor, 4 Months - $1,000 Fine)",
       "Using Illegal Fishing Gear or Methods (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Without a License (Infraction, $250 Fine)"
      ]
     },
     {
      "id": "count",
      "label": "Count",
      "type": "text",
      "placeholder": "1",
      "width": "narrow"
     }
    ],
    "check": {
     "id": "",
     "label": ""
    },
    "when": {
     "field": "teuType",
     "is": [
      "Traffic Stop Report"
     ]
    }
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Vehicle Information",
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Impound Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "imMake",
      "label": "Make",
      "type": "text",
      "placeholder": "Declasse"
     },
     {
      "id": "imModel",
      "label": "Model",
      "type": "text",
      "placeholder": "Vigero"
     },
     {
      "id": "imColor",
      "label": "Color",
      "type": "select",
      "options": [
       "White",
       "Black",
       "Silver",
       "Gray",
       "Red",
       "Blue",
       "Green",
       "Yellow",
       "Orange",
       "Brown",
       "Beige",
       "Gold",
       "Purple",
       "Maroon"
      ],
      "blank": true
     },
     {
      "id": "imPlate",
      "label": "Plate",
      "type": "text",
      "placeholder": "8XYZ442",
      "required": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Impound Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "imReason",
      "label": "Reason for Impound",
      "type": "select",
      "options": [
       "Arrest of Driver",
       "Abandoned",
       "Stolen",
       "Evidence Hold",
       "Illegal Parking",
       "Street Racing",
       "Reckless Driving",
       "Other"
      ],
      "required": true,
      "blank": true
     },
     {
      "id": "imInv",
      "label": "Inventory Search Completed",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Impound Report"
     ]
    }
   },
   {
    "type": "repeater",
    "id": "imItems",
    "title": "ITEMS FOUND",
    "addLabel": "+ Add Item",
    "columns": [
     {
      "id": "item",
      "label": "Item",
      "type": "text",
      "placeholder": "Duffel bag"
     },
     {
      "id": "where",
      "label": "Where found / notes",
      "type": "text",
      "width": "wide"
     }
    ],
    "check": {
     "id": "",
     "label": ""
    },
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Impound Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "imLot",
      "label": "Impound Lot Location",
      "type": "text",
      "placeholder": "Davis Impound"
     },
     {
      "id": "imOwner",
      "label": "Registered Owner Notified",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Impound Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "imStart",
      "label": "Time Initiated",
      "type": "time"
     },
     {
      "id": "imEnd",
      "label": "Time Terminated",
      "type": "time"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Impound Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "puReason",
      "label": "Reason for Pursuit",
      "type": "text",
      "placeholder": "Failure to yield after a traffic stop",
      "required": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Suspect Vehicle",
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "puVeh",
      "label": "Make / Model",
      "type": "text",
      "placeholder": "Pegassi Zentorno"
     },
     {
      "id": "puColor",
      "label": "Color",
      "type": "select",
      "options": [
       "White",
       "Black",
       "Silver",
       "Gray",
       "Red",
       "Blue",
       "Green",
       "Yellow",
       "Orange",
       "Brown",
       "Beige",
       "Gold",
       "Purple",
       "Maroon"
      ],
      "blank": true
     },
     {
      "id": "puPlate",
      "label": "Plate",
      "type": "text",
      "placeholder": "4FAST44"
     },
     {
      "id": "puOcc",
      "label": "Occupants",
      "type": "text",
      "placeholder": "2"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Pursuit Details",
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "puTop",
      "label": "Top Speed",
      "type": "text",
      "placeholder": "140 mph"
     },
     {
      "id": "puTraffic",
      "label": "Traffic Conditions",
      "type": "text",
      "placeholder": "Moderate"
     },
     {
      "id": "puStart",
      "label": "Started",
      "type": "time"
     },
     {
      "id": "puEnd",
      "label": "Ended",
      "type": "time"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "puUnits",
      "label": "Units Involved",
      "type": "officers",
      "allowTyped": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "checklist",
    "id": "puTactics",
    "title": "TACTICS USED",
    "colTopic": "Item",
    "colStandard": "",
    "colCheck": "✓",
    "items": [
     {
      "topic": "Pursuit Intervention (PIT)",
      "standard": ""
     },
     {
      "topic": "Spike Strips",
      "standard": ""
     },
     {
      "topic": "Rolling Roadblock",
      "standard": ""
     },
     {
      "topic": "Air Unit",
      "standard": ""
     },
     {
      "topic": "Terminated Due to Risk",
      "standard": ""
     }
    ],
    "display": "selected",
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "puOutcome",
      "label": "Outcome",
      "type": "select",
      "options": [
       "Suspect Arrested",
       "Suspect Escaped",
       "Vehicle Disabled",
       "Crash"
      ],
      "required": true,
      "blank": true
     },
     {
      "id": "puSup",
      "label": "Supervisor Approval",
      "type": "officer"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "puDamage",
      "label": "Property Damage",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     },
     {
      "id": "puInj",
      "label": "Injuries",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "longtext",
    "id": "puNarr",
    "title": "PURSUIT NARRATIVE",
    "maxLength": 2000,
    "hint": "Where it started, the route, why it ended.",
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "repeater",
    "id": "puCharges",
    "title": "CHARGES / CITATIONS",
    "addLabel": "+ Add Charge",
    "totals": {
     "on": true,
     "col": "charge",
     "countCol": "count"
    },
    "columns": [
     {
      "id": "charge",
      "label": "Charge (type to search)",
      "type": "search",
      "options": [
       "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violating boating safety regulations (Misdemeanor, 4 Months - $1,000 Fine)",
       "No Wake Zone (Misdemeanor, $1,750 Fine)",
       "Operating a vessel without the proper registration (Infraction, $250 Fine)",
       "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
       "Driving Without a Commercial Driver's License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Submit Vehicle to Inspection (Misdemeanor, 4 Months - $2,250 Fine)",
       "Overweight Vehicle (Infraction, $250 Fine)",
       "Defective Equipment (Infraction, $250 Fine)",
       "Inadequate Safety Inspections (Infraction, $250 Fine)",
       "Failure to Maintain Logbooks (Infraction, $250 Fine)",
       "Improper Transport of Hazardous Materials (Infraction, $250 Fine)",
       "Failure to Carry Proper Documentation (Infraction, $250 Fine)",
       "Driving Without Proper Permits (Infraction, $250 Fine)",
       "Hours of Service Violation (Infraction, $250 Fine)",
       "Medical Certificate Violation (Infraction, $250 Fine)",
       "Improper Load Securement (Infraction, $250 Fine)",
       "Online Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Phishing (Felony, 7 Months - $3,000 Fine)",
       "Unauthorized Access to Computer Systems (Felony, 7 Months - $3,000 Fine)",
       "Possession of Controlled Substances (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
       "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Driving Under Drug Influence (Felony, 7 Months - $3,000 Fine)",
       "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
       "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
       "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
       "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
       "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
       "Public Sale of Drugs (Felony, 7 Months - $3,000 Fine)",
       "Possession of Drug Paraphernalia (Felony, 7 Months - $3,000 Fine)",
       "Illegal Dumping (Misdemeanor, 4 Months - $1,000 Fine)",
       "Overfishing (Infraction, $250 Fine)",
       "Illegal Logging (Felony, 7 Months - $3,000 Fine)",
       "Endangered Species Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Illegal Mining (Felony, 7 Months - $3,000 Fine)",
       "Poaching (Felony, 7 Months - $3,000 Fine)",
       "Careless or Reckless Aircraft Operation (Misdemeanor, 5 Months - $1,000 Fine)",
       "Operating Without a Pilot Certificate (Misdemeanor, 5 Months - $1,000 Fine)",
       "Consuming Personal Alcohol Aboard an Aircraft (Misdemeanor, 5 Months - $2,500 Fine)",
       "Boarding While Intoxicated (Misdemeanor, 5 Months - $1,500 Fine)",
       "Undeclared Hazardous Materials (Misdemeanor, 5 Months - $1,000 Fine)",
       "Falsification of FAA Records (Felony, 10 Months - $2,500 Fine)",
       "Violation of a Temporary Flight Restriction (Felony, 5 Months - $3,500 Fine)",
       "Operating an Aircraft to Facilitate Drug Trafficking (Felony, 20 Months - $5,000 Fine)",
       "Assault Aboard an Aircraft (Felony, 15 Months - $2,500 Fine)",
       "Carrying a Weapon Aboard an Aircraft (Felony, 15 Months - $5,000 Fine)",
       "Carrying an Explosive or Incendiary Device Aboard (Felony, 20 Months - $5,000 Fine)",
       "Aircraft Hijacking (Felony, 20 Months - $5,000 Fine)",
       "Criminal Transportation of Hazardous Materials (Felony, 15 Months - $2,500 Fine)",
       "Failure to Declare an Item (Misdemeanor, 5 Months - $1,000 Fine)",
       "Importing Prohibited Agricultural Items (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare a Firearm (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare Prescription Medication (Misdemeanor, 5 Months - $1,000 Fine)",
       "Improper Entry (Felony, 15 Months - $5,000 Fine)",
       "Illegal Re-entry (Felony, 20 Months - $5,000 Fine)",
       "Alien Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Attempted Human Smuggling (Felony, 15 Months - $2,500 Fine)",
       "Conspiracy to Commit Human Trafficking (Felony, 15 Months - $5,000 Fine)",
       "Visa or Immigration-Document Fraud (Felony, 15 Months - $5,000 Fine)",
       "Unlawful Transportation (Felony, 15 Months - $2,500 Fine)",
       "Bringing a Person Through an Unauthorized Location (Felony, 15 Months - $3,500 Fine)",
       "Passport Forgery or False Use (Felony, 15 Months - $2,500 Fine)",
       "High-Speed Flight From an Immigration Checkpoint (Felony, 10 Months - $2,500 Fine)",
       "Forcibly Resisting or Impeding a Federal Agent (Felony, 10 Months - $500 Fine)",
       "Aggravated Assault on a Federal Agent (Felony, 15 Months - $2,000 Fine)",
       "False Statements to a Federal Agent (Felony, 5 Months - $500 Fine)",
       "Possession of Contraband at a Checkpoint (Felony, 10 Months - $1,000 Fine)",
       "Alien Smuggling Discovered at a Checkpoint (Felony, 15 Months - $2,000 Fine)",
       "False Customs Declaration (Felony, 10 Months - $2,500 Fine)",
       "Smuggling Goods Into the United States (Felony, 10 Months - $1,000 Fine)",
       "Undeclared Currency or Monetary Instruments (Felony, 15 Months - $2,000 Fine)",
       "Illegal Importation of a Firearm (Felony, 7 Months - $1,000 Fine)",
       "Firearm Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Drug Smuggling Through Concealment (Felony, 20 Months - $5,000 Fine)",
       "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Arrest (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
       "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violation Of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
       "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
       "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
       "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sightseeing at the Scene of an Emergency (Misdemeanor, 6 Months - $1,200 Fine)",
       "Unlawful Assembly (Infraction, $250 Fine)",
       "Littering (Infraction, $250 Fine)",
       "Perjury (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
       "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
       "Aiding and Abetting (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Peace Officer (Felony, 7 Months - $3,000 Fine)",
       "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
       "Marked Bills (Felony, 9 Months - $3,000 Fine)",
       "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
       "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
       "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
       "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
       "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
       "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
       "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
       "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Trespassing (Infraction, $250 Fine)",
       "Burglary (Felony, 11 Months - $6,000 Fine)",
       "Arson (Felony, 14 Months - $10,000 Fine)",
       "Credit Card Fraud (Felony, 5 Months - $3,000 Fine)",
       "Breaking and Entering (Felony, 5 Months - $3,000 Fine)",
       "Identity Theft (Felony, 5 Months - $3,000 Fine)",
       "Theft of Public Property (Felony, 5 Months - $3,000 Fine)",
       "Extortion (Felony, 5 Months - $3,000 Fine)",
       "Attempted Robbery (Felony, 8 Months - $3,000 Fine)",
       "Disorderly Conduct (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Intoxication (Misdemeanor, 4 Months - $1,000 Fine)",
       "Indecent Exposure (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Mischief (Misdemeanor, 4 Months - $1,000 Fine)",
       "Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Aiding & Abetting (Misdemeanor) (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Identify (Misdemeanor, 4 Months - $1,000 Fine)",
       "Loitering (Infraction, $250 Fine)",
       "Disturbing the Peace (Infraction, $250 Fine)",
       "Illegal Protests (Infraction, $250 Fine)",
       "Rioting (Felony, 7 Months - $3,000 Fine)",
       "Bribery (Felony, 7 Months - $3,000 Fine)",
       "Inciting a Riot (Felony, 7 Months - $3,000 Fine)",
       "Illegal Immigration (Felony, 7 Months - $3,000 Fine)",
       "Reckless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Driving Without a License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Road Rage Incident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Attempted Grand Theft Auto (Misdemeanor, 7 Months - $3,000 Fine)",
       "Leaving the Scene of a Vehicle Accident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Careless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Operating a Vehicle with Suspended License (Misdemeanor)",
       "Driving a Motorcycle Without a Motorcycle License (Misdemeanor, $500 Fine)",
       "Speeding (Infraction, $250 Fine)",
       "Running a Red Light (Infraction, $250 Fine)",
       "Driving Without Insurance (Infraction, $250 Fine)",
       "Failure to Yield (Infraction, $250 Fine)",
       "Illegal U-Turn (Infraction, $250 Fine)",
       "Driving Without Headlights (Infraction, $250 Fine)",
       "Driving in the Wrong Direction (Infraction, $250 Fine)",
       "Illegal Parking in Handicap Zones (Infraction, $250 Fine)",
       "Excessive Window Tinting (Infraction, $250 Fine)",
       "Failure to Maintain Lanes (Infraction, $250 Fine)",
       "Unsafe Passing (Infraction, $250 Fine)",
       "Failure to Yield to an Emergency Vehicle (Infraction, $250 Fine)",
       "Obstructed License Plate (Infraction, $250 Fine)",
       "Unsafe Hauling (Infraction, $250 Fine)",
       "Parking in a Fire Zone (Infraction, $250 Fine)",
       "Failure to Yield to a Traffic Device (Infraction, $250 Fine)",
       "Improper Vehicle Safety Equipment (Infraction, $250 Fine)",
       "Operating an Unroadworthy Vehicle on a Public Roadway (Infraction, $250 Fine)",
       "Lighting Violation (Infraction, $250 Fine)",
       "Improper Parking, Stopping, or Standing (Infraction, $250 Fine)",
       "Unsafe Lane Changes (Infraction, $250 Fine)",
       "Operating a Motorcycle Without a Helmet (Infraction, $250 Fine)",
       "Impeding Traffic (Infraction, $250 Fine)",
       "Using a Handheld Device While Driving (Infraction, $250 Fine)",
       "Improper Use of Horn (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrian in Crosswalk (Infraction, $250 Fine)",
       "Crossing a Double Yellow Line (Infraction, $250 Fine)",
       "Passing on the Shoulder (Infraction, $250 Fine)",
       "Towing Without a License (Infraction, $500 Fine)",
       "Move Over Law (Infraction, $250 Fine)",
       "Illegally Parked in a No Parking Zone (Infraction, $250 Fine)",
       "Failure to Pay for Parking Meter (Infraction, $250 Fine)",
       "Blocking a Driveway (Infraction, $250 Fine)",
       "Blocking a Crosswalk (Infraction, $250 Fine)",
       "Facing the Wrong Way (Infraction, $250 Fine)",
       "Bus Stop Violation (Infraction, $250 Fine)",
       "Blocking an Intersection (Infraction, $250 Fine)",
       "Parking Within 15 Feet of a Fire Station Driveway (Infraction, $250 Fine)",
       "Blocking Railroad Crossing (Infraction, $250 Fine)",
       "Parking on a Sidewalk Median or Divider (Infraction, $250 Fine)",
       "Unregistered Vehicle (Infraction, $250 Fine)",
       "Towing Without a Valid Operator's License (Infraction, $500 Fine)",
       "Failure to Signal (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrians (Infraction, $250 Fine)",
       "Blocking Emergency Access Lanes (Infraction, $250 Fine)",
       "Expired Insurance (Infraction, $250 Fine)",
       "Fictitious Plate (Infraction, $250 Fine)",
       "Prohibited Underglow Lighting (Infraction, $250 Fine)",
       "Tailgating (Infraction, $250 Fine)",
       "Plate Violation (Infraction, $250 Fine)",
       "Operating a Vehicle While Using a Miscellaneous Object (Infraction, $500 Fine)",
       "Occupying a Side of the Freeway (Infraction, $250 Fine)",
       "Parking in an Alley Way (Infraction, $250 Fine)",
       "Unlawful Riding in a Vehicle (Infraction, $500 Fine)",
       "Driving Under the Influence (DUI) (Felony, 7 Months - $3,000 Fine)",
       "Hit and Run (Felony, 7 Months - $3,000 Fine)",
       "Street Racing (Felony, 7 Months - $3,000 Fine)",
       "Fleeing/Attempting to Elude (Felony, 7 Months - $3,000 Fine)",
       "Possession of a Stolen Vehicle (Felony, 7 Months - $3,000 Fine)",
       "Felony Speeding (Felony, 9 Months - $6,000 Fine)",
       "Grand Theft Auto (Felony, 7 Months - $6,000 Fine)",
       "Assault (Misdemeanor, 7 Months - $3,000 Fine)",
       "Battery (Misdemeanor, 7 Months - $3,000 Fine)",
       "Reckless Endangerment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Stalking (Misdemeanor, 7 Months - $3,000 Fine)",
       "Robbery (Felony, 15 Months - $6,000 Fine)",
       "Homicide (Felony, 18 Months - $10,000 Fine)",
       "Domestic Violence (Felony, 15 Months - $6,000 Fine)",
       "Kidnapping (Felony, 18 Months - $10,000 Fine)",
       "Aggravated Assault (Felony, 18 Months - $10,000 Fine)",
       "Terroristic Threats (Felony, 7 Months - $3,000 Fine)",
       "Vehicular Manslaughter (Felony, 18 Months - $10,000 Fine)",
       "Attempted Murder of a Government Official (Felony, 18 Months - $6,000 Fine)",
       "Brandishing a Firearm in Public (Felony, 15 Months - $6,000 Fine)",
       "Assault of a Peace Officer (Felony, 15 Months - $6,000 Fine)",
       "Attempted Murder (Felony, 18 Months - $10,000 Fine)",
       "Armed Robbery (Felony, 18 Months - $9,000 Fine)",
       "Aggravated Battery (Felony, 15 Months - $6,000 Fine)",
       "Battery on a Law Enforcement Officer (Felony, 15 Months - $6,000 Fine)",
       "Second-Degree Murder (Felony, 15 Months - $6,000 Fine)",
       "Capital Murder (Felony, 15 Months - $6,000 Fine)",
       "Carjacking (Felony, 15 Months - $6,000 Fine)",
       "Solicitation to Commit Murder (Felony, 9 Months - $10,000 Fine)",
       "Obstructing Justice (Felony, 7 Months - $3,000 Fine)",
       "Possession of Assault Weapon (Felony, 7 Months - $2,250 Fine)",
       "Brandishing a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Using a Weapon While Intoxicated (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Secure a Firearm (Misdemeanor, 7 Months - $3,000 Fine)",
       "Carrying a Loaded Firearm in Public (Misdemeanor, 7 Months - $3,000 Fine)",
       "Negligent Use of a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Possession of a Firearm Without a License (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Report Lost/Stolen Firearm (Misdemeanor, 4 Months - $1,000 Fine)",
       "Firearm in a Restricted Zone (Misdemeanor, 4 Months - $1,000 Fine)",
       "Carrying a Concealed Weapon Without Permit (Felony, 15 Months - $6,000 Fine)",
       "Illegal Sale of Firearms (Felony, 15 Months - $6,000 Fine)",
       "Unlawful Discharge of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Prohibited Weapon (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Weapon in a Restricted Area (Felony, 15 Months - $6,000 Fine)",
       "Trafficking Illegal Firearms (Felony, 15 Months - $6,000 Fine)",
       "Modifying a Firearm Illegally (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Firearm Without a Serial Number (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Stolen Firearm (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Open Carry (Felony, 7 Months - $3,000 Fine)",
       "Reckless Firearm Discharge (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of Deadly Weapon (Felony, 15 Months - $6,000 Fine)",
       "Discharge of a Firearm in City Limits (Felony, 15 Months - $6,000 Fine)",
       "Unserialized (\"Ghost\") Firearm (Felony, 15 Months - $6,000 Fine)",
       "Carrying Firearm While Masked (Felony, 15 Months - $6,000 Fine)",
       "Undetectable Firearm (Felony, 15 Months - $6,000 Fine)",
       "Sale to Prohibited Person (Felony, 15 Months - $6,000 Fine)",
       "Straw Purchase of Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of an Unregistered Firearm (Felony, 9 Months)",
       "Illegal Transfer of a Firearm (Felony, 12 Months - $6,000 Fine)",
       "Possession of Ammunition by a Felon (Felony, 9 Months - $4,000 Fine)",
       "Possession of Explosive Device(s) (Felony, 18 Months - $8,000 Fine)",
       "Carrying a Firearm While Being Underage (Felony, 9 Months - $2,000 Fine)",
       "Possession of a Weapon in Commission of a Crime (Felony, 12 Months - $6,000 Fine)",
       "Possession of an Illegal Firearm Modification (Felony, 12 Months - $1,200 Fine)",
       "Embezzlement (Felony, 11 Months - $6,000 Fine)",
       "Fraud (Felony, 5 Months - $3,000 Fine)",
       "Tax Evasion (Felony, 5 Months - $3,000 Fine)",
       "Money Laundering (Felony, 5 Months - $3,000 Fine)",
       "Insider Trading (Felony, 5 Months - $3,000 Fine)",
       "Forgery (Felony, 5 Months - $3,000 Fine)",
       "Cybercrime (Felony, 5 Months - $3,000 Fine)",
       "Healthcare Fraud (Felony, 5 Months - $3,000 Fine)",
       "Ponzi Scheme (Felony, 5 Months - $3,000 Fine)",
       "Counterfeiting (Felony, 5 Months - $3,000 Fine)",
       "Corporate Espionage (Felony, 5 Months - $3,000 Fine)",
       "Animal Abuse and Cruelty (Misdemeanor, 4 Months - $1,000 Fine)",
       "Possession of Illegally Taken Wildlife (Misdemeanor, 4 Months - $1,000 Fine)",
       "Importation of Restricted Animals (Misdemeanor, 4 Months - $1,000 Fine)",
       "Exceeding Daily Catch Limits (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Out of Season or in Protected Areas (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sale of Illegally Taken Fish (Misdemeanor, 4 Months - $1,000 Fine)",
       "Endangered Species Violation (Misdemeanor, 4 Months - $1,000 Fine)",
       "Using Illegal Fishing Gear or Methods (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Without a License (Infraction, $250 Fine)"
      ]
     },
     {
      "id": "count",
      "label": "Count",
      "type": "text",
      "placeholder": "1",
      "width": "narrow"
     }
    ],
    "check": {
     "id": "",
     "label": ""
    },
    "when": {
     "field": "teuType",
     "is": [
      "Vehicle Pursuit Report"
     ]
    }
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Driver Information",
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "duName",
      "label": "Name",
      "type": "text",
      "placeholder": "Trevor Phillips",
      "required": true
     },
     {
      "id": "duId",
      "label": "State ID",
      "type": "text",
      "placeholder": "SA-5551234"
     },
     {
      "id": "duDob",
      "label": "DOB",
      "type": "date"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "duMake",
      "label": "Make",
      "type": "text",
      "placeholder": "Canis"
     },
     {
      "id": "duModel",
      "label": "Model",
      "type": "text",
      "placeholder": "Bodhi"
     },
     {
      "id": "duPlate",
      "label": "Plate",
      "type": "text",
      "placeholder": "2DRUNK2"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "checklist",
    "id": "duObs",
    "title": "INITIAL OBSERVATIONS",
    "colTopic": "Item",
    "colStandard": "",
    "colCheck": "✓",
    "items": [
     {
      "topic": "Odor of Alcohol",
      "standard": ""
     },
     {
      "topic": "Slurred Speech",
      "standard": ""
     },
     {
      "topic": "Bloodshot Eyes",
      "standard": ""
     },
     {
      "topic": "Unsteady Balance",
      "standard": ""
     },
     {
      "topic": "Admission of Drinking",
      "standard": ""
     }
    ],
    "display": "selected",
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "checklist",
    "id": "duFst",
    "title": "FIELD SOBRIETY TESTS",
    "colTopic": "Item",
    "colStandard": "",
    "colCheck": "✓",
    "items": [
     {
      "topic": "Horizontal Gaze Nystagmus",
      "standard": ""
     },
     {
      "topic": "Walk and Turn",
      "standard": ""
     },
     {
      "topic": "One Leg Stand",
      "standard": ""
     }
    ],
    "display": "selected",
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "duResult",
      "label": "Test Result",
      "type": "select",
      "options": [
       "Failed",
       "Passed",
       "Refused"
      ],
      "blank": true
     },
     {
      "id": "duPbt",
      "label": "Preliminary Breath Test",
      "type": "text",
      "placeholder": "Administered"
     },
     {
      "id": "duBac",
      "label": "BAC Reading",
      "type": "text",
      "placeholder": "0.14"
     },
     {
      "id": "duRefused",
      "label": "Refused",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "longtext",
    "id": "duPc",
    "title": "PROBABLE CAUSE STATEMENT",
    "maxLength": 2000,
    "hint": "What you saw, smelled and heard that gave you probable cause.",
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "duArrest",
      "label": "Arrest Made",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "required": true,
      "blank": true
     },
     {
      "id": "duDispo",
      "label": "Vehicle Disposition",
      "type": "select",
      "options": [
       "Released",
       "Impounded"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "duCam",
      "label": "Bodycam Active",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "repeater",
    "id": "duCharges",
    "title": "CHARGES / CITATIONS",
    "addLabel": "+ Add Charge",
    "totals": {
     "on": true,
     "col": "charge",
     "countCol": "count"
    },
    "columns": [
     {
      "id": "charge",
      "label": "Charge (type to search)",
      "type": "search",
      "options": [
       "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violating boating safety regulations (Misdemeanor, 4 Months - $1,000 Fine)",
       "No Wake Zone (Misdemeanor, $1,750 Fine)",
       "Operating a vessel without the proper registration (Infraction, $250 Fine)",
       "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
       "Driving Without a Commercial Driver's License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Submit Vehicle to Inspection (Misdemeanor, 4 Months - $2,250 Fine)",
       "Overweight Vehicle (Infraction, $250 Fine)",
       "Defective Equipment (Infraction, $250 Fine)",
       "Inadequate Safety Inspections (Infraction, $250 Fine)",
       "Failure to Maintain Logbooks (Infraction, $250 Fine)",
       "Improper Transport of Hazardous Materials (Infraction, $250 Fine)",
       "Failure to Carry Proper Documentation (Infraction, $250 Fine)",
       "Driving Without Proper Permits (Infraction, $250 Fine)",
       "Hours of Service Violation (Infraction, $250 Fine)",
       "Medical Certificate Violation (Infraction, $250 Fine)",
       "Improper Load Securement (Infraction, $250 Fine)",
       "Online Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Phishing (Felony, 7 Months - $3,000 Fine)",
       "Unauthorized Access to Computer Systems (Felony, 7 Months - $3,000 Fine)",
       "Possession of Controlled Substances (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
       "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Driving Under Drug Influence (Felony, 7 Months - $3,000 Fine)",
       "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
       "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
       "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
       "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
       "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
       "Public Sale of Drugs (Felony, 7 Months - $3,000 Fine)",
       "Possession of Drug Paraphernalia (Felony, 7 Months - $3,000 Fine)",
       "Illegal Dumping (Misdemeanor, 4 Months - $1,000 Fine)",
       "Overfishing (Infraction, $250 Fine)",
       "Illegal Logging (Felony, 7 Months - $3,000 Fine)",
       "Endangered Species Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Illegal Mining (Felony, 7 Months - $3,000 Fine)",
       "Poaching (Felony, 7 Months - $3,000 Fine)",
       "Careless or Reckless Aircraft Operation (Misdemeanor, 5 Months - $1,000 Fine)",
       "Operating Without a Pilot Certificate (Misdemeanor, 5 Months - $1,000 Fine)",
       "Consuming Personal Alcohol Aboard an Aircraft (Misdemeanor, 5 Months - $2,500 Fine)",
       "Boarding While Intoxicated (Misdemeanor, 5 Months - $1,500 Fine)",
       "Undeclared Hazardous Materials (Misdemeanor, 5 Months - $1,000 Fine)",
       "Falsification of FAA Records (Felony, 10 Months - $2,500 Fine)",
       "Violation of a Temporary Flight Restriction (Felony, 5 Months - $3,500 Fine)",
       "Operating an Aircraft to Facilitate Drug Trafficking (Felony, 20 Months - $5,000 Fine)",
       "Assault Aboard an Aircraft (Felony, 15 Months - $2,500 Fine)",
       "Carrying a Weapon Aboard an Aircraft (Felony, 15 Months - $5,000 Fine)",
       "Carrying an Explosive or Incendiary Device Aboard (Felony, 20 Months - $5,000 Fine)",
       "Aircraft Hijacking (Felony, 20 Months - $5,000 Fine)",
       "Criminal Transportation of Hazardous Materials (Felony, 15 Months - $2,500 Fine)",
       "Failure to Declare an Item (Misdemeanor, 5 Months - $1,000 Fine)",
       "Importing Prohibited Agricultural Items (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare a Firearm (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare Prescription Medication (Misdemeanor, 5 Months - $1,000 Fine)",
       "Improper Entry (Felony, 15 Months - $5,000 Fine)",
       "Illegal Re-entry (Felony, 20 Months - $5,000 Fine)",
       "Alien Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Attempted Human Smuggling (Felony, 15 Months - $2,500 Fine)",
       "Conspiracy to Commit Human Trafficking (Felony, 15 Months - $5,000 Fine)",
       "Visa or Immigration-Document Fraud (Felony, 15 Months - $5,000 Fine)",
       "Unlawful Transportation (Felony, 15 Months - $2,500 Fine)",
       "Bringing a Person Through an Unauthorized Location (Felony, 15 Months - $3,500 Fine)",
       "Passport Forgery or False Use (Felony, 15 Months - $2,500 Fine)",
       "High-Speed Flight From an Immigration Checkpoint (Felony, 10 Months - $2,500 Fine)",
       "Forcibly Resisting or Impeding a Federal Agent (Felony, 10 Months - $500 Fine)",
       "Aggravated Assault on a Federal Agent (Felony, 15 Months - $2,000 Fine)",
       "False Statements to a Federal Agent (Felony, 5 Months - $500 Fine)",
       "Possession of Contraband at a Checkpoint (Felony, 10 Months - $1,000 Fine)",
       "Alien Smuggling Discovered at a Checkpoint (Felony, 15 Months - $2,000 Fine)",
       "False Customs Declaration (Felony, 10 Months - $2,500 Fine)",
       "Smuggling Goods Into the United States (Felony, 10 Months - $1,000 Fine)",
       "Undeclared Currency or Monetary Instruments (Felony, 15 Months - $2,000 Fine)",
       "Illegal Importation of a Firearm (Felony, 7 Months - $1,000 Fine)",
       "Firearm Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Drug Smuggling Through Concealment (Felony, 20 Months - $5,000 Fine)",
       "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Arrest (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
       "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violation Of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
       "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
       "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
       "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sightseeing at the Scene of an Emergency (Misdemeanor, 6 Months - $1,200 Fine)",
       "Unlawful Assembly (Infraction, $250 Fine)",
       "Littering (Infraction, $250 Fine)",
       "Perjury (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
       "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
       "Aiding and Abetting (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Peace Officer (Felony, 7 Months - $3,000 Fine)",
       "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
       "Marked Bills (Felony, 9 Months - $3,000 Fine)",
       "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
       "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
       "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
       "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
       "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
       "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
       "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
       "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Trespassing (Infraction, $250 Fine)",
       "Burglary (Felony, 11 Months - $6,000 Fine)",
       "Arson (Felony, 14 Months - $10,000 Fine)",
       "Credit Card Fraud (Felony, 5 Months - $3,000 Fine)",
       "Breaking and Entering (Felony, 5 Months - $3,000 Fine)",
       "Identity Theft (Felony, 5 Months - $3,000 Fine)",
       "Theft of Public Property (Felony, 5 Months - $3,000 Fine)",
       "Extortion (Felony, 5 Months - $3,000 Fine)",
       "Attempted Robbery (Felony, 8 Months - $3,000 Fine)",
       "Disorderly Conduct (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Intoxication (Misdemeanor, 4 Months - $1,000 Fine)",
       "Indecent Exposure (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Mischief (Misdemeanor, 4 Months - $1,000 Fine)",
       "Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Aiding & Abetting (Misdemeanor) (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Identify (Misdemeanor, 4 Months - $1,000 Fine)",
       "Loitering (Infraction, $250 Fine)",
       "Disturbing the Peace (Infraction, $250 Fine)",
       "Illegal Protests (Infraction, $250 Fine)",
       "Rioting (Felony, 7 Months - $3,000 Fine)",
       "Bribery (Felony, 7 Months - $3,000 Fine)",
       "Inciting a Riot (Felony, 7 Months - $3,000 Fine)",
       "Illegal Immigration (Felony, 7 Months - $3,000 Fine)",
       "Reckless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Driving Without a License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Road Rage Incident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Attempted Grand Theft Auto (Misdemeanor, 7 Months - $3,000 Fine)",
       "Leaving the Scene of a Vehicle Accident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Careless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Operating a Vehicle with Suspended License (Misdemeanor)",
       "Driving a Motorcycle Without a Motorcycle License (Misdemeanor, $500 Fine)",
       "Speeding (Infraction, $250 Fine)",
       "Running a Red Light (Infraction, $250 Fine)",
       "Driving Without Insurance (Infraction, $250 Fine)",
       "Failure to Yield (Infraction, $250 Fine)",
       "Illegal U-Turn (Infraction, $250 Fine)",
       "Driving Without Headlights (Infraction, $250 Fine)",
       "Driving in the Wrong Direction (Infraction, $250 Fine)",
       "Illegal Parking in Handicap Zones (Infraction, $250 Fine)",
       "Excessive Window Tinting (Infraction, $250 Fine)",
       "Failure to Maintain Lanes (Infraction, $250 Fine)",
       "Unsafe Passing (Infraction, $250 Fine)",
       "Failure to Yield to an Emergency Vehicle (Infraction, $250 Fine)",
       "Obstructed License Plate (Infraction, $250 Fine)",
       "Unsafe Hauling (Infraction, $250 Fine)",
       "Parking in a Fire Zone (Infraction, $250 Fine)",
       "Failure to Yield to a Traffic Device (Infraction, $250 Fine)",
       "Improper Vehicle Safety Equipment (Infraction, $250 Fine)",
       "Operating an Unroadworthy Vehicle on a Public Roadway (Infraction, $250 Fine)",
       "Lighting Violation (Infraction, $250 Fine)",
       "Improper Parking, Stopping, or Standing (Infraction, $250 Fine)",
       "Unsafe Lane Changes (Infraction, $250 Fine)",
       "Operating a Motorcycle Without a Helmet (Infraction, $250 Fine)",
       "Impeding Traffic (Infraction, $250 Fine)",
       "Using a Handheld Device While Driving (Infraction, $250 Fine)",
       "Improper Use of Horn (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrian in Crosswalk (Infraction, $250 Fine)",
       "Crossing a Double Yellow Line (Infraction, $250 Fine)",
       "Passing on the Shoulder (Infraction, $250 Fine)",
       "Towing Without a License (Infraction, $500 Fine)",
       "Move Over Law (Infraction, $250 Fine)",
       "Illegally Parked in a No Parking Zone (Infraction, $250 Fine)",
       "Failure to Pay for Parking Meter (Infraction, $250 Fine)",
       "Blocking a Driveway (Infraction, $250 Fine)",
       "Blocking a Crosswalk (Infraction, $250 Fine)",
       "Facing the Wrong Way (Infraction, $250 Fine)",
       "Bus Stop Violation (Infraction, $250 Fine)",
       "Blocking an Intersection (Infraction, $250 Fine)",
       "Parking Within 15 Feet of a Fire Station Driveway (Infraction, $250 Fine)",
       "Blocking Railroad Crossing (Infraction, $250 Fine)",
       "Parking on a Sidewalk Median or Divider (Infraction, $250 Fine)",
       "Unregistered Vehicle (Infraction, $250 Fine)",
       "Towing Without a Valid Operator's License (Infraction, $500 Fine)",
       "Failure to Signal (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrians (Infraction, $250 Fine)",
       "Blocking Emergency Access Lanes (Infraction, $250 Fine)",
       "Expired Insurance (Infraction, $250 Fine)",
       "Fictitious Plate (Infraction, $250 Fine)",
       "Prohibited Underglow Lighting (Infraction, $250 Fine)",
       "Tailgating (Infraction, $250 Fine)",
       "Plate Violation (Infraction, $250 Fine)",
       "Operating a Vehicle While Using a Miscellaneous Object (Infraction, $500 Fine)",
       "Occupying a Side of the Freeway (Infraction, $250 Fine)",
       "Parking in an Alley Way (Infraction, $250 Fine)",
       "Unlawful Riding in a Vehicle (Infraction, $500 Fine)",
       "Driving Under the Influence (DUI) (Felony, 7 Months - $3,000 Fine)",
       "Hit and Run (Felony, 7 Months - $3,000 Fine)",
       "Street Racing (Felony, 7 Months - $3,000 Fine)",
       "Fleeing/Attempting to Elude (Felony, 7 Months - $3,000 Fine)",
       "Possession of a Stolen Vehicle (Felony, 7 Months - $3,000 Fine)",
       "Felony Speeding (Felony, 9 Months - $6,000 Fine)",
       "Grand Theft Auto (Felony, 7 Months - $6,000 Fine)",
       "Assault (Misdemeanor, 7 Months - $3,000 Fine)",
       "Battery (Misdemeanor, 7 Months - $3,000 Fine)",
       "Reckless Endangerment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Stalking (Misdemeanor, 7 Months - $3,000 Fine)",
       "Robbery (Felony, 15 Months - $6,000 Fine)",
       "Homicide (Felony, 18 Months - $10,000 Fine)",
       "Domestic Violence (Felony, 15 Months - $6,000 Fine)",
       "Kidnapping (Felony, 18 Months - $10,000 Fine)",
       "Aggravated Assault (Felony, 18 Months - $10,000 Fine)",
       "Terroristic Threats (Felony, 7 Months - $3,000 Fine)",
       "Vehicular Manslaughter (Felony, 18 Months - $10,000 Fine)",
       "Attempted Murder of a Government Official (Felony, 18 Months - $6,000 Fine)",
       "Brandishing a Firearm in Public (Felony, 15 Months - $6,000 Fine)",
       "Assault of a Peace Officer (Felony, 15 Months - $6,000 Fine)",
       "Attempted Murder (Felony, 18 Months - $10,000 Fine)",
       "Armed Robbery (Felony, 18 Months - $9,000 Fine)",
       "Aggravated Battery (Felony, 15 Months - $6,000 Fine)",
       "Battery on a Law Enforcement Officer (Felony, 15 Months - $6,000 Fine)",
       "Second-Degree Murder (Felony, 15 Months - $6,000 Fine)",
       "Capital Murder (Felony, 15 Months - $6,000 Fine)",
       "Carjacking (Felony, 15 Months - $6,000 Fine)",
       "Solicitation to Commit Murder (Felony, 9 Months - $10,000 Fine)",
       "Obstructing Justice (Felony, 7 Months - $3,000 Fine)",
       "Possession of Assault Weapon (Felony, 7 Months - $2,250 Fine)",
       "Brandishing a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Using a Weapon While Intoxicated (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Secure a Firearm (Misdemeanor, 7 Months - $3,000 Fine)",
       "Carrying a Loaded Firearm in Public (Misdemeanor, 7 Months - $3,000 Fine)",
       "Negligent Use of a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Possession of a Firearm Without a License (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Report Lost/Stolen Firearm (Misdemeanor, 4 Months - $1,000 Fine)",
       "Firearm in a Restricted Zone (Misdemeanor, 4 Months - $1,000 Fine)",
       "Carrying a Concealed Weapon Without Permit (Felony, 15 Months - $6,000 Fine)",
       "Illegal Sale of Firearms (Felony, 15 Months - $6,000 Fine)",
       "Unlawful Discharge of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Prohibited Weapon (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Weapon in a Restricted Area (Felony, 15 Months - $6,000 Fine)",
       "Trafficking Illegal Firearms (Felony, 15 Months - $6,000 Fine)",
       "Modifying a Firearm Illegally (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Firearm Without a Serial Number (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Stolen Firearm (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Open Carry (Felony, 7 Months - $3,000 Fine)",
       "Reckless Firearm Discharge (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of Deadly Weapon (Felony, 15 Months - $6,000 Fine)",
       "Discharge of a Firearm in City Limits (Felony, 15 Months - $6,000 Fine)",
       "Unserialized (\"Ghost\") Firearm (Felony, 15 Months - $6,000 Fine)",
       "Carrying Firearm While Masked (Felony, 15 Months - $6,000 Fine)",
       "Undetectable Firearm (Felony, 15 Months - $6,000 Fine)",
       "Sale to Prohibited Person (Felony, 15 Months - $6,000 Fine)",
       "Straw Purchase of Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of an Unregistered Firearm (Felony, 9 Months)",
       "Illegal Transfer of a Firearm (Felony, 12 Months - $6,000 Fine)",
       "Possession of Ammunition by a Felon (Felony, 9 Months - $4,000 Fine)",
       "Possession of Explosive Device(s) (Felony, 18 Months - $8,000 Fine)",
       "Carrying a Firearm While Being Underage (Felony, 9 Months - $2,000 Fine)",
       "Possession of a Weapon in Commission of a Crime (Felony, 12 Months - $6,000 Fine)",
       "Possession of an Illegal Firearm Modification (Felony, 12 Months - $1,200 Fine)",
       "Embezzlement (Felony, 11 Months - $6,000 Fine)",
       "Fraud (Felony, 5 Months - $3,000 Fine)",
       "Tax Evasion (Felony, 5 Months - $3,000 Fine)",
       "Money Laundering (Felony, 5 Months - $3,000 Fine)",
       "Insider Trading (Felony, 5 Months - $3,000 Fine)",
       "Forgery (Felony, 5 Months - $3,000 Fine)",
       "Cybercrime (Felony, 5 Months - $3,000 Fine)",
       "Healthcare Fraud (Felony, 5 Months - $3,000 Fine)",
       "Ponzi Scheme (Felony, 5 Months - $3,000 Fine)",
       "Counterfeiting (Felony, 5 Months - $3,000 Fine)",
       "Corporate Espionage (Felony, 5 Months - $3,000 Fine)",
       "Animal Abuse and Cruelty (Misdemeanor, 4 Months - $1,000 Fine)",
       "Possession of Illegally Taken Wildlife (Misdemeanor, 4 Months - $1,000 Fine)",
       "Importation of Restricted Animals (Misdemeanor, 4 Months - $1,000 Fine)",
       "Exceeding Daily Catch Limits (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Out of Season or in Protected Areas (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sale of Illegally Taken Fish (Misdemeanor, 4 Months - $1,000 Fine)",
       "Endangered Species Violation (Misdemeanor, 4 Months - $1,000 Fine)",
       "Using Illegal Fishing Gear or Methods (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Without a License (Infraction, $250 Fine)"
      ]
     },
     {
      "id": "count",
      "label": "Count",
      "type": "text",
      "placeholder": "1",
      "width": "narrow"
     }
    ],
    "check": {
     "id": "",
     "label": ""
    },
    "when": {
     "field": "teuType",
     "is": [
      "DUI Investigation Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "cvCert",
      "label": "CVE Certification #",
      "type": "text",
      "placeholder": "CVE-2041"
     },
     {
      "id": "cvCompany",
      "label": "Company Name",
      "type": "text",
      "placeholder": "Post OP",
      "required": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Commercial Vehicle Info",
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "cvDriver",
      "label": "Driver Name",
      "type": "text",
      "placeholder": "Ron Jakowski",
      "required": true
     },
     {
      "id": "cvId",
      "label": "State ID",
      "type": "text",
      "placeholder": "SA-8812004"
     },
     {
      "id": "cvClass",
      "label": "License Class",
      "type": "select",
      "options": [
       "Class A",
       "Class B",
       "Class C"
      ],
      "blank": true
     },
     {
      "id": "cvMed",
      "label": "Medical Card Valid",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "cvMake",
      "label": "Make",
      "type": "text",
      "placeholder": "MTL"
     },
     {
      "id": "cvModel",
      "label": "Model",
      "type": "text",
      "placeholder": "Packer"
     },
     {
      "id": "cvPlate",
      "label": "Plate",
      "type": "text",
      "placeholder": "7TRK220"
     },
     {
      "id": "cvTrailer",
      "label": "Trailer #",
      "type": "text",
      "placeholder": "TR-4471"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "cvAxle",
      "label": "Axle Count",
      "type": "text",
      "placeholder": "5"
     },
     {
      "id": "cvLevel",
      "label": "Inspection Level",
      "type": "select",
      "options": [
       "Level I (Full Inspection)",
       "Level II (Walkaround)",
       "Level III (Driver/Docs Only)"
      ],
      "required": true,
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "cvGross",
      "label": "Gross Weight",
      "type": "text",
      "placeholder": "82,000 lbs"
     },
     {
      "id": "cvLimit",
      "label": "Legal Limit",
      "type": "text",
      "placeholder": "80,000 lbs"
     },
     {
      "id": "cvOver",
      "label": "Overweight",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "checklist",
    "id": "cvDocs",
    "title": "DOCUMENTATION CHECK",
    "colTopic": "Item",
    "colStandard": "",
    "colCheck": "✓",
    "items": [
     {
      "topic": "Logbook",
      "standard": ""
     },
     {
      "topic": "Registration",
      "standard": ""
     },
     {
      "topic": "Bill of Lading",
      "standard": ""
     },
     {
      "topic": "Hazmat Endorsement",
      "standard": ""
     },
     {
      "topic": "Insurance",
      "standard": ""
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "repeater",
    "id": "cvViol",
    "title": "VIOLATIONS FOUND",
    "addLabel": "+ Add Violation",
    "columns": [
     {
      "id": "charge",
      "label": "Violation (type to search)",
      "type": "search",
      "options": [
       "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violating boating safety regulations (Misdemeanor, 4 Months - $1,000 Fine)",
       "No Wake Zone (Misdemeanor, $1,750 Fine)",
       "Operating a vessel without the proper registration (Infraction, $250 Fine)",
       "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
       "Driving Without a Commercial Driver's License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Submit Vehicle to Inspection (Misdemeanor, 4 Months - $2,250 Fine)",
       "Overweight Vehicle (Infraction, $250 Fine)",
       "Defective Equipment (Infraction, $250 Fine)",
       "Inadequate Safety Inspections (Infraction, $250 Fine)",
       "Failure to Maintain Logbooks (Infraction, $250 Fine)",
       "Improper Transport of Hazardous Materials (Infraction, $250 Fine)",
       "Failure to Carry Proper Documentation (Infraction, $250 Fine)",
       "Driving Without Proper Permits (Infraction, $250 Fine)",
       "Hours of Service Violation (Infraction, $250 Fine)",
       "Medical Certificate Violation (Infraction, $250 Fine)",
       "Improper Load Securement (Infraction, $250 Fine)",
       "Online Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Phishing (Felony, 7 Months - $3,000 Fine)",
       "Unauthorized Access to Computer Systems (Felony, 7 Months - $3,000 Fine)",
       "Possession of Controlled Substances (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
       "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Driving Under Drug Influence (Felony, 7 Months - $3,000 Fine)",
       "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
       "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
       "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
       "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
       "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
       "Public Sale of Drugs (Felony, 7 Months - $3,000 Fine)",
       "Possession of Drug Paraphernalia (Felony, 7 Months - $3,000 Fine)",
       "Illegal Dumping (Misdemeanor, 4 Months - $1,000 Fine)",
       "Overfishing (Infraction, $250 Fine)",
       "Illegal Logging (Felony, 7 Months - $3,000 Fine)",
       "Endangered Species Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Illegal Mining (Felony, 7 Months - $3,000 Fine)",
       "Poaching (Felony, 7 Months - $3,000 Fine)",
       "Careless or Reckless Aircraft Operation (Misdemeanor, 5 Months - $1,000 Fine)",
       "Operating Without a Pilot Certificate (Misdemeanor, 5 Months - $1,000 Fine)",
       "Consuming Personal Alcohol Aboard an Aircraft (Misdemeanor, 5 Months - $2,500 Fine)",
       "Boarding While Intoxicated (Misdemeanor, 5 Months - $1,500 Fine)",
       "Undeclared Hazardous Materials (Misdemeanor, 5 Months - $1,000 Fine)",
       "Falsification of FAA Records (Felony, 10 Months - $2,500 Fine)",
       "Violation of a Temporary Flight Restriction (Felony, 5 Months - $3,500 Fine)",
       "Operating an Aircraft to Facilitate Drug Trafficking (Felony, 20 Months - $5,000 Fine)",
       "Assault Aboard an Aircraft (Felony, 15 Months - $2,500 Fine)",
       "Carrying a Weapon Aboard an Aircraft (Felony, 15 Months - $5,000 Fine)",
       "Carrying an Explosive or Incendiary Device Aboard (Felony, 20 Months - $5,000 Fine)",
       "Aircraft Hijacking (Felony, 20 Months - $5,000 Fine)",
       "Criminal Transportation of Hazardous Materials (Felony, 15 Months - $2,500 Fine)",
       "Failure to Declare an Item (Misdemeanor, 5 Months - $1,000 Fine)",
       "Importing Prohibited Agricultural Items (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare a Firearm (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare Prescription Medication (Misdemeanor, 5 Months - $1,000 Fine)",
       "Improper Entry (Felony, 15 Months - $5,000 Fine)",
       "Illegal Re-entry (Felony, 20 Months - $5,000 Fine)",
       "Alien Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Attempted Human Smuggling (Felony, 15 Months - $2,500 Fine)",
       "Conspiracy to Commit Human Trafficking (Felony, 15 Months - $5,000 Fine)",
       "Visa or Immigration-Document Fraud (Felony, 15 Months - $5,000 Fine)",
       "Unlawful Transportation (Felony, 15 Months - $2,500 Fine)",
       "Bringing a Person Through an Unauthorized Location (Felony, 15 Months - $3,500 Fine)",
       "Passport Forgery or False Use (Felony, 15 Months - $2,500 Fine)",
       "High-Speed Flight From an Immigration Checkpoint (Felony, 10 Months - $2,500 Fine)",
       "Forcibly Resisting or Impeding a Federal Agent (Felony, 10 Months - $500 Fine)",
       "Aggravated Assault on a Federal Agent (Felony, 15 Months - $2,000 Fine)",
       "False Statements to a Federal Agent (Felony, 5 Months - $500 Fine)",
       "Possession of Contraband at a Checkpoint (Felony, 10 Months - $1,000 Fine)",
       "Alien Smuggling Discovered at a Checkpoint (Felony, 15 Months - $2,000 Fine)",
       "False Customs Declaration (Felony, 10 Months - $2,500 Fine)",
       "Smuggling Goods Into the United States (Felony, 10 Months - $1,000 Fine)",
       "Undeclared Currency or Monetary Instruments (Felony, 15 Months - $2,000 Fine)",
       "Illegal Importation of a Firearm (Felony, 7 Months - $1,000 Fine)",
       "Firearm Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Drug Smuggling Through Concealment (Felony, 20 Months - $5,000 Fine)",
       "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Arrest (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
       "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violation Of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
       "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
       "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
       "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sightseeing at the Scene of an Emergency (Misdemeanor, 6 Months - $1,200 Fine)",
       "Unlawful Assembly (Infraction, $250 Fine)",
       "Littering (Infraction, $250 Fine)",
       "Perjury (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
       "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
       "Aiding and Abetting (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Peace Officer (Felony, 7 Months - $3,000 Fine)",
       "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
       "Marked Bills (Felony, 9 Months - $3,000 Fine)",
       "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
       "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
       "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
       "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
       "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
       "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
       "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
       "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Trespassing (Infraction, $250 Fine)",
       "Burglary (Felony, 11 Months - $6,000 Fine)",
       "Arson (Felony, 14 Months - $10,000 Fine)",
       "Credit Card Fraud (Felony, 5 Months - $3,000 Fine)",
       "Breaking and Entering (Felony, 5 Months - $3,000 Fine)",
       "Identity Theft (Felony, 5 Months - $3,000 Fine)",
       "Theft of Public Property (Felony, 5 Months - $3,000 Fine)",
       "Extortion (Felony, 5 Months - $3,000 Fine)",
       "Attempted Robbery (Felony, 8 Months - $3,000 Fine)",
       "Disorderly Conduct (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Intoxication (Misdemeanor, 4 Months - $1,000 Fine)",
       "Indecent Exposure (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Mischief (Misdemeanor, 4 Months - $1,000 Fine)",
       "Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Aiding & Abetting (Misdemeanor) (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Identify (Misdemeanor, 4 Months - $1,000 Fine)",
       "Loitering (Infraction, $250 Fine)",
       "Disturbing the Peace (Infraction, $250 Fine)",
       "Illegal Protests (Infraction, $250 Fine)",
       "Rioting (Felony, 7 Months - $3,000 Fine)",
       "Bribery (Felony, 7 Months - $3,000 Fine)",
       "Inciting a Riot (Felony, 7 Months - $3,000 Fine)",
       "Illegal Immigration (Felony, 7 Months - $3,000 Fine)",
       "Reckless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Driving Without a License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Road Rage Incident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Attempted Grand Theft Auto (Misdemeanor, 7 Months - $3,000 Fine)",
       "Leaving the Scene of a Vehicle Accident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Careless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Operating a Vehicle with Suspended License (Misdemeanor)",
       "Driving a Motorcycle Without a Motorcycle License (Misdemeanor, $500 Fine)",
       "Speeding (Infraction, $250 Fine)",
       "Running a Red Light (Infraction, $250 Fine)",
       "Driving Without Insurance (Infraction, $250 Fine)",
       "Failure to Yield (Infraction, $250 Fine)",
       "Illegal U-Turn (Infraction, $250 Fine)",
       "Driving Without Headlights (Infraction, $250 Fine)",
       "Driving in the Wrong Direction (Infraction, $250 Fine)",
       "Illegal Parking in Handicap Zones (Infraction, $250 Fine)",
       "Excessive Window Tinting (Infraction, $250 Fine)",
       "Failure to Maintain Lanes (Infraction, $250 Fine)",
       "Unsafe Passing (Infraction, $250 Fine)",
       "Failure to Yield to an Emergency Vehicle (Infraction, $250 Fine)",
       "Obstructed License Plate (Infraction, $250 Fine)",
       "Unsafe Hauling (Infraction, $250 Fine)",
       "Parking in a Fire Zone (Infraction, $250 Fine)",
       "Failure to Yield to a Traffic Device (Infraction, $250 Fine)",
       "Improper Vehicle Safety Equipment (Infraction, $250 Fine)",
       "Operating an Unroadworthy Vehicle on a Public Roadway (Infraction, $250 Fine)",
       "Lighting Violation (Infraction, $250 Fine)",
       "Improper Parking, Stopping, or Standing (Infraction, $250 Fine)",
       "Unsafe Lane Changes (Infraction, $250 Fine)",
       "Operating a Motorcycle Without a Helmet (Infraction, $250 Fine)",
       "Impeding Traffic (Infraction, $250 Fine)",
       "Using a Handheld Device While Driving (Infraction, $250 Fine)",
       "Improper Use of Horn (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrian in Crosswalk (Infraction, $250 Fine)",
       "Crossing a Double Yellow Line (Infraction, $250 Fine)",
       "Passing on the Shoulder (Infraction, $250 Fine)",
       "Towing Without a License (Infraction, $500 Fine)",
       "Move Over Law (Infraction, $250 Fine)",
       "Illegally Parked in a No Parking Zone (Infraction, $250 Fine)",
       "Failure to Pay for Parking Meter (Infraction, $250 Fine)",
       "Blocking a Driveway (Infraction, $250 Fine)",
       "Blocking a Crosswalk (Infraction, $250 Fine)",
       "Facing the Wrong Way (Infraction, $250 Fine)",
       "Bus Stop Violation (Infraction, $250 Fine)",
       "Blocking an Intersection (Infraction, $250 Fine)",
       "Parking Within 15 Feet of a Fire Station Driveway (Infraction, $250 Fine)",
       "Blocking Railroad Crossing (Infraction, $250 Fine)",
       "Parking on a Sidewalk Median or Divider (Infraction, $250 Fine)",
       "Unregistered Vehicle (Infraction, $250 Fine)",
       "Towing Without a Valid Operator's License (Infraction, $500 Fine)",
       "Failure to Signal (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrians (Infraction, $250 Fine)",
       "Blocking Emergency Access Lanes (Infraction, $250 Fine)",
       "Expired Insurance (Infraction, $250 Fine)",
       "Fictitious Plate (Infraction, $250 Fine)",
       "Prohibited Underglow Lighting (Infraction, $250 Fine)",
       "Tailgating (Infraction, $250 Fine)",
       "Plate Violation (Infraction, $250 Fine)",
       "Operating a Vehicle While Using a Miscellaneous Object (Infraction, $500 Fine)",
       "Occupying a Side of the Freeway (Infraction, $250 Fine)",
       "Parking in an Alley Way (Infraction, $250 Fine)",
       "Unlawful Riding in a Vehicle (Infraction, $500 Fine)",
       "Driving Under the Influence (DUI) (Felony, 7 Months - $3,000 Fine)",
       "Hit and Run (Felony, 7 Months - $3,000 Fine)",
       "Street Racing (Felony, 7 Months - $3,000 Fine)",
       "Fleeing/Attempting to Elude (Felony, 7 Months - $3,000 Fine)",
       "Possession of a Stolen Vehicle (Felony, 7 Months - $3,000 Fine)",
       "Felony Speeding (Felony, 9 Months - $6,000 Fine)",
       "Grand Theft Auto (Felony, 7 Months - $6,000 Fine)",
       "Assault (Misdemeanor, 7 Months - $3,000 Fine)",
       "Battery (Misdemeanor, 7 Months - $3,000 Fine)",
       "Reckless Endangerment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Stalking (Misdemeanor, 7 Months - $3,000 Fine)",
       "Robbery (Felony, 15 Months - $6,000 Fine)",
       "Homicide (Felony, 18 Months - $10,000 Fine)",
       "Domestic Violence (Felony, 15 Months - $6,000 Fine)",
       "Kidnapping (Felony, 18 Months - $10,000 Fine)",
       "Aggravated Assault (Felony, 18 Months - $10,000 Fine)",
       "Terroristic Threats (Felony, 7 Months - $3,000 Fine)",
       "Vehicular Manslaughter (Felony, 18 Months - $10,000 Fine)",
       "Attempted Murder of a Government Official (Felony, 18 Months - $6,000 Fine)",
       "Brandishing a Firearm in Public (Felony, 15 Months - $6,000 Fine)",
       "Assault of a Peace Officer (Felony, 15 Months - $6,000 Fine)",
       "Attempted Murder (Felony, 18 Months - $10,000 Fine)",
       "Armed Robbery (Felony, 18 Months - $9,000 Fine)",
       "Aggravated Battery (Felony, 15 Months - $6,000 Fine)",
       "Battery on a Law Enforcement Officer (Felony, 15 Months - $6,000 Fine)",
       "Second-Degree Murder (Felony, 15 Months - $6,000 Fine)",
       "Capital Murder (Felony, 15 Months - $6,000 Fine)",
       "Carjacking (Felony, 15 Months - $6,000 Fine)",
       "Solicitation to Commit Murder (Felony, 9 Months - $10,000 Fine)",
       "Obstructing Justice (Felony, 7 Months - $3,000 Fine)",
       "Possession of Assault Weapon (Felony, 7 Months - $2,250 Fine)",
       "Brandishing a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Using a Weapon While Intoxicated (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Secure a Firearm (Misdemeanor, 7 Months - $3,000 Fine)",
       "Carrying a Loaded Firearm in Public (Misdemeanor, 7 Months - $3,000 Fine)",
       "Negligent Use of a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Possession of a Firearm Without a License (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Report Lost/Stolen Firearm (Misdemeanor, 4 Months - $1,000 Fine)",
       "Firearm in a Restricted Zone (Misdemeanor, 4 Months - $1,000 Fine)",
       "Carrying a Concealed Weapon Without Permit (Felony, 15 Months - $6,000 Fine)",
       "Illegal Sale of Firearms (Felony, 15 Months - $6,000 Fine)",
       "Unlawful Discharge of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Prohibited Weapon (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Weapon in a Restricted Area (Felony, 15 Months - $6,000 Fine)",
       "Trafficking Illegal Firearms (Felony, 15 Months - $6,000 Fine)",
       "Modifying a Firearm Illegally (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Firearm Without a Serial Number (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Stolen Firearm (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Open Carry (Felony, 7 Months - $3,000 Fine)",
       "Reckless Firearm Discharge (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of Deadly Weapon (Felony, 15 Months - $6,000 Fine)",
       "Discharge of a Firearm in City Limits (Felony, 15 Months - $6,000 Fine)",
       "Unserialized (\"Ghost\") Firearm (Felony, 15 Months - $6,000 Fine)",
       "Carrying Firearm While Masked (Felony, 15 Months - $6,000 Fine)",
       "Undetectable Firearm (Felony, 15 Months - $6,000 Fine)",
       "Sale to Prohibited Person (Felony, 15 Months - $6,000 Fine)",
       "Straw Purchase of Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of an Unregistered Firearm (Felony, 9 Months)",
       "Illegal Transfer of a Firearm (Felony, 12 Months - $6,000 Fine)",
       "Possession of Ammunition by a Felon (Felony, 9 Months - $4,000 Fine)",
       "Possession of Explosive Device(s) (Felony, 18 Months - $8,000 Fine)",
       "Carrying a Firearm While Being Underage (Felony, 9 Months - $2,000 Fine)",
       "Possession of a Weapon in Commission of a Crime (Felony, 12 Months - $6,000 Fine)",
       "Possession of an Illegal Firearm Modification (Felony, 12 Months - $1,200 Fine)",
       "Embezzlement (Felony, 11 Months - $6,000 Fine)",
       "Fraud (Felony, 5 Months - $3,000 Fine)",
       "Tax Evasion (Felony, 5 Months - $3,000 Fine)",
       "Money Laundering (Felony, 5 Months - $3,000 Fine)",
       "Insider Trading (Felony, 5 Months - $3,000 Fine)",
       "Forgery (Felony, 5 Months - $3,000 Fine)",
       "Cybercrime (Felony, 5 Months - $3,000 Fine)",
       "Healthcare Fraud (Felony, 5 Months - $3,000 Fine)",
       "Ponzi Scheme (Felony, 5 Months - $3,000 Fine)",
       "Counterfeiting (Felony, 5 Months - $3,000 Fine)",
       "Corporate Espionage (Felony, 5 Months - $3,000 Fine)",
       "Animal Abuse and Cruelty (Misdemeanor, 4 Months - $1,000 Fine)",
       "Possession of Illegally Taken Wildlife (Misdemeanor, 4 Months - $1,000 Fine)",
       "Importation of Restricted Animals (Misdemeanor, 4 Months - $1,000 Fine)",
       "Exceeding Daily Catch Limits (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Out of Season or in Protected Areas (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sale of Illegally Taken Fish (Misdemeanor, 4 Months - $1,000 Fine)",
       "Endangered Species Violation (Misdemeanor, 4 Months - $1,000 Fine)",
       "Using Illegal Fishing Gear or Methods (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Without a License (Infraction, $250 Fine)"
      ]
     },
     {
      "id": "notes",
      "label": "Notes",
      "type": "text",
      "width": "wide"
     }
    ],
    "check": {
     "id": "",
     "label": ""
    },
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "cvAction",
      "label": "Enforcement Action",
      "type": "select",
      "options": [
       "Cleared",
       "Citation Issued",
       "Out of Service Order",
       "Vehicle Impounded"
      ],
      "required": true,
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "longtext",
    "id": "cvNotes",
    "title": "NOTES",
    "maxLength": 2000,
    "when": {
     "field": "teuType",
     "is": [
      "CVE Inspection Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "inCall",
      "label": "Call Type",
      "type": "text",
      "placeholder": "Minor collision",
      "required": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Incident Report (Non-Arrest)"
     ]
    }
   },
   {
    "type": "repeater",
    "id": "inParties",
    "title": "INVOLVED PARTIES",
    "addLabel": "+ Add Party",
    "columns": [
     {
      "id": "name",
      "label": "Name",
      "type": "text"
     },
     {
      "id": "role",
      "label": "Role",
      "type": "select",
      "blank": true,
      "options": [
       "Driver",
       "Passenger",
       "Victim",
       "Witness",
       "Complainant",
       "Involved Party"
      ]
     },
     {
      "id": "sid",
      "label": "State ID / contact",
      "type": "text"
     }
    ],
    "check": {
     "id": "",
     "label": ""
    },
    "when": {
     "field": "teuType",
     "is": [
      "Incident Report (Non-Arrest)"
     ]
    }
   },
   {
    "type": "longtext",
    "id": "inSummary",
    "title": "SUMMARY OF INCIDENT",
    "maxLength": 2000,
    "when": {
     "field": "teuType",
     "is": [
      "Incident Report (Non-Arrest)"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "inInj",
      "label": "Injuries Reported",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     },
     {
      "id": "inInjDesc",
      "label": "If yes, describe",
      "type": "text"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Incident Report (Non-Arrest)"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "inDmg",
      "label": "Property Damage",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     },
     {
      "id": "inDmgDesc",
      "label": "If yes, describe",
      "type": "text"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Incident Report (Non-Arrest)"
     ]
    }
   },
   {
    "type": "checklist",
    "id": "inEvid",
    "title": "EVIDENCE COLLECTED",
    "colTopic": "Item",
    "colStandard": "",
    "colCheck": "✓",
    "items": [
     {
      "topic": "Photos",
      "standard": ""
     },
     {
      "topic": "CCTV",
      "standard": ""
     },
     {
      "topic": "Shell Casings",
      "standard": ""
     },
     {
      "topic": "Weapon",
      "standard": ""
     }
    ],
    "display": "selected",
    "when": {
     "field": "teuType",
     "is": [
      "Incident Report (Non-Arrest)"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "inStatus",
      "label": "Case Status",
      "type": "select",
      "options": [
       "Active Investigation",
       "Closed – No Further Action",
       "Forwarded to Detectives"
      ],
      "required": true,
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Incident Report (Non-Arrest)"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "bpType",
      "label": "Patrol Type",
      "type": "select",
      "options": [
       "Directed Enforcement",
       "Event Detail",
       "Routine Patrol"
      ],
      "blank": true
     },
     {
      "id": "bpUnit",
      "label": "BPU Unit ID",
      "type": "select",
      "options": [
       "Bicycle 1",
       "Bicycle 2"
      ],
      "blank": true
     },
     {
      "id": "bpInc",
      "label": "Incident Type",
      "type": "select",
      "options": [
       "Traffic Stop",
       "Pedestrian Stop",
       "Citation Issued",
       "Handed off to Cruiser (Arrest/Transport)",
       "Area Check / Resolved",
       "Other"
      ],
      "required": true,
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Bicycle Patrol Unit Report"
     ]
    }
   },
   {
    "type": "text",
    "style": "heading",
    "text": "Vehicle / Subject Information",
    "when": {
     "field": "teuType",
     "is": [
      "Bicycle Patrol Unit Report"
     ]
    }
   },
   {
    "type": "strip",
    "fields": [
     {
      "id": "bpName",
      "label": "Full Name",
      "type": "text"
     },
     {
      "id": "bpId",
      "label": "State ID",
      "type": "text"
     },
     {
      "id": "bpDob",
      "label": "Date of Birth",
      "type": "date"
     },
     {
      "id": "bpLic",
      "label": "License Status",
      "type": "select",
      "options": [
       "Valid",
       "Suspended",
       "Revoked"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Bicycle Patrol Unit Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "bpBolo",
      "label": "Vehicle / BOLO Info (if applicable)",
      "type": "text"
     },
     {
      "id": "bpReason",
      "label": "Reason for Stop / Contact",
      "type": "text"
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Bicycle Patrol Unit Report"
     ]
    }
   },
   {
    "type": "fields",
    "fields": [
     {
      "id": "bpAction",
      "label": "Enforcement Action",
      "type": "select",
      "options": [
       "Verbal Warning",
       "Citation Issued",
       "Handed off to Cruiser",
       "Area Check / Resolved (No Action)"
      ],
      "blank": true
     },
     {
      "id": "bpCam",
      "label": "Bodycam Active",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "blank": true
     }
    ],
    "when": {
     "field": "teuType",
     "is": [
      "Bicycle Patrol Unit Report"
     ]
    }
   },
   {
    "type": "repeater",
    "id": "bpCharges",
    "title": "CHARGES / VIOLATIONS",
    "addLabel": "+ Add Charge",
    "totals": {
     "on": true,
     "col": "charge",
     "countCol": "count"
    },
    "columns": [
     {
      "id": "charge",
      "label": "Charge (type to search)",
      "type": "search",
      "options": [
       "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violating boating safety regulations (Misdemeanor, 4 Months - $1,000 Fine)",
       "No Wake Zone (Misdemeanor, $1,750 Fine)",
       "Operating a vessel without the proper registration (Infraction, $250 Fine)",
       "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
       "Driving Without a Commercial Driver's License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Submit Vehicle to Inspection (Misdemeanor, 4 Months - $2,250 Fine)",
       "Overweight Vehicle (Infraction, $250 Fine)",
       "Defective Equipment (Infraction, $250 Fine)",
       "Inadequate Safety Inspections (Infraction, $250 Fine)",
       "Failure to Maintain Logbooks (Infraction, $250 Fine)",
       "Improper Transport of Hazardous Materials (Infraction, $250 Fine)",
       "Failure to Carry Proper Documentation (Infraction, $250 Fine)",
       "Driving Without Proper Permits (Infraction, $250 Fine)",
       "Hours of Service Violation (Infraction, $250 Fine)",
       "Medical Certificate Violation (Infraction, $250 Fine)",
       "Improper Load Securement (Infraction, $250 Fine)",
       "Online Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Phishing (Felony, 7 Months - $3,000 Fine)",
       "Unauthorized Access to Computer Systems (Felony, 7 Months - $3,000 Fine)",
       "Possession of Controlled Substances (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
       "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Driving Under Drug Influence (Felony, 7 Months - $3,000 Fine)",
       "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
       "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
       "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
       "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
       "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
       "Public Sale of Drugs (Felony, 7 Months - $3,000 Fine)",
       "Possession of Drug Paraphernalia (Felony, 7 Months - $3,000 Fine)",
       "Illegal Dumping (Misdemeanor, 4 Months - $1,000 Fine)",
       "Overfishing (Infraction, $250 Fine)",
       "Illegal Logging (Felony, 7 Months - $3,000 Fine)",
       "Endangered Species Trafficking (Felony, 15 Months - $6,000 Fine)",
       "Illegal Mining (Felony, 7 Months - $3,000 Fine)",
       "Poaching (Felony, 7 Months - $3,000 Fine)",
       "Careless or Reckless Aircraft Operation (Misdemeanor, 5 Months - $1,000 Fine)",
       "Operating Without a Pilot Certificate (Misdemeanor, 5 Months - $1,000 Fine)",
       "Consuming Personal Alcohol Aboard an Aircraft (Misdemeanor, 5 Months - $2,500 Fine)",
       "Boarding While Intoxicated (Misdemeanor, 5 Months - $1,500 Fine)",
       "Undeclared Hazardous Materials (Misdemeanor, 5 Months - $1,000 Fine)",
       "Falsification of FAA Records (Felony, 10 Months - $2,500 Fine)",
       "Violation of a Temporary Flight Restriction (Felony, 5 Months - $3,500 Fine)",
       "Operating an Aircraft to Facilitate Drug Trafficking (Felony, 20 Months - $5,000 Fine)",
       "Assault Aboard an Aircraft (Felony, 15 Months - $2,500 Fine)",
       "Carrying a Weapon Aboard an Aircraft (Felony, 15 Months - $5,000 Fine)",
       "Carrying an Explosive or Incendiary Device Aboard (Felony, 20 Months - $5,000 Fine)",
       "Aircraft Hijacking (Felony, 20 Months - $5,000 Fine)",
       "Criminal Transportation of Hazardous Materials (Felony, 15 Months - $2,500 Fine)",
       "Failure to Declare an Item (Misdemeanor, 5 Months - $1,000 Fine)",
       "Importing Prohibited Agricultural Items (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare a Firearm (Misdemeanor, 5 Months - $1,000 Fine)",
       "Failure to Declare Prescription Medication (Misdemeanor, 5 Months - $1,000 Fine)",
       "Improper Entry (Felony, 15 Months - $5,000 Fine)",
       "Illegal Re-entry (Felony, 20 Months - $5,000 Fine)",
       "Alien Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Attempted Human Smuggling (Felony, 15 Months - $2,500 Fine)",
       "Conspiracy to Commit Human Trafficking (Felony, 15 Months - $5,000 Fine)",
       "Visa or Immigration-Document Fraud (Felony, 15 Months - $5,000 Fine)",
       "Unlawful Transportation (Felony, 15 Months - $2,500 Fine)",
       "Bringing a Person Through an Unauthorized Location (Felony, 15 Months - $3,500 Fine)",
       "Passport Forgery or False Use (Felony, 15 Months - $2,500 Fine)",
       "High-Speed Flight From an Immigration Checkpoint (Felony, 10 Months - $2,500 Fine)",
       "Forcibly Resisting or Impeding a Federal Agent (Felony, 10 Months - $500 Fine)",
       "Aggravated Assault on a Federal Agent (Felony, 15 Months - $2,000 Fine)",
       "False Statements to a Federal Agent (Felony, 5 Months - $500 Fine)",
       "Possession of Contraband at a Checkpoint (Felony, 10 Months - $1,000 Fine)",
       "Alien Smuggling Discovered at a Checkpoint (Felony, 15 Months - $2,000 Fine)",
       "False Customs Declaration (Felony, 10 Months - $2,500 Fine)",
       "Smuggling Goods Into the United States (Felony, 10 Months - $1,000 Fine)",
       "Undeclared Currency or Monetary Instruments (Felony, 15 Months - $2,000 Fine)",
       "Illegal Importation of a Firearm (Felony, 7 Months - $1,000 Fine)",
       "Firearm Smuggling (Felony, 15 Months - $5,000 Fine)",
       "Drug Smuggling Through Concealment (Felony, 20 Months - $5,000 Fine)",
       "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Arrest (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
       "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
       "Violation Of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
       "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
       "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
       "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
       "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sightseeing at the Scene of an Emergency (Misdemeanor, 6 Months - $1,200 Fine)",
       "Unlawful Assembly (Infraction, $250 Fine)",
       "Littering (Infraction, $250 Fine)",
       "Perjury (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
       "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
       "Aiding and Abetting (Felony, 7 Months - $3,000 Fine)",
       "Impersonating a Peace Officer (Felony, 7 Months - $3,000 Fine)",
       "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
       "Marked Bills (Felony, 9 Months - $3,000 Fine)",
       "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
       "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
       "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
       "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
       "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
       "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
       "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
       "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
       "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
       "Trespassing (Infraction, $250 Fine)",
       "Burglary (Felony, 11 Months - $6,000 Fine)",
       "Arson (Felony, 14 Months - $10,000 Fine)",
       "Credit Card Fraud (Felony, 5 Months - $3,000 Fine)",
       "Breaking and Entering (Felony, 5 Months - $3,000 Fine)",
       "Identity Theft (Felony, 5 Months - $3,000 Fine)",
       "Theft of Public Property (Felony, 5 Months - $3,000 Fine)",
       "Extortion (Felony, 5 Months - $3,000 Fine)",
       "Attempted Robbery (Felony, 8 Months - $3,000 Fine)",
       "Disorderly Conduct (Misdemeanor, 4 Months - $1,000 Fine)",
       "Public Intoxication (Misdemeanor, 4 Months - $1,000 Fine)",
       "Indecent Exposure (Misdemeanor, 4 Months - $1,000 Fine)",
       "Criminal Mischief (Misdemeanor, 4 Months - $1,000 Fine)",
       "Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Aiding & Abetting (Misdemeanor) (Misdemeanor, 4 Months - $1,000 Fine)",
       "Failure to Identify (Misdemeanor, 4 Months - $1,000 Fine)",
       "Loitering (Infraction, $250 Fine)",
       "Disturbing the Peace (Infraction, $250 Fine)",
       "Illegal Protests (Infraction, $250 Fine)",
       "Rioting (Felony, 7 Months - $3,000 Fine)",
       "Bribery (Felony, 7 Months - $3,000 Fine)",
       "Inciting a Riot (Felony, 7 Months - $3,000 Fine)",
       "Illegal Immigration (Felony, 7 Months - $3,000 Fine)",
       "Reckless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Driving Without a License (Misdemeanor, 4 Months - $1,000 Fine)",
       "Road Rage Incident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Attempted Grand Theft Auto (Misdemeanor, 7 Months - $3,000 Fine)",
       "Leaving the Scene of a Vehicle Accident (Misdemeanor, 4 Months - $1,000 Fine)",
       "Careless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
       "Operating a Vehicle with Suspended License (Misdemeanor)",
       "Driving a Motorcycle Without a Motorcycle License (Misdemeanor, $500 Fine)",
       "Speeding (Infraction, $250 Fine)",
       "Running a Red Light (Infraction, $250 Fine)",
       "Driving Without Insurance (Infraction, $250 Fine)",
       "Failure to Yield (Infraction, $250 Fine)",
       "Illegal U-Turn (Infraction, $250 Fine)",
       "Driving Without Headlights (Infraction, $250 Fine)",
       "Driving in the Wrong Direction (Infraction, $250 Fine)",
       "Illegal Parking in Handicap Zones (Infraction, $250 Fine)",
       "Excessive Window Tinting (Infraction, $250 Fine)",
       "Failure to Maintain Lanes (Infraction, $250 Fine)",
       "Unsafe Passing (Infraction, $250 Fine)",
       "Failure to Yield to an Emergency Vehicle (Infraction, $250 Fine)",
       "Obstructed License Plate (Infraction, $250 Fine)",
       "Unsafe Hauling (Infraction, $250 Fine)",
       "Parking in a Fire Zone (Infraction, $250 Fine)",
       "Failure to Yield to a Traffic Device (Infraction, $250 Fine)",
       "Improper Vehicle Safety Equipment (Infraction, $250 Fine)",
       "Operating an Unroadworthy Vehicle on a Public Roadway (Infraction, $250 Fine)",
       "Lighting Violation (Infraction, $250 Fine)",
       "Improper Parking, Stopping, or Standing (Infraction, $250 Fine)",
       "Unsafe Lane Changes (Infraction, $250 Fine)",
       "Operating a Motorcycle Without a Helmet (Infraction, $250 Fine)",
       "Impeding Traffic (Infraction, $250 Fine)",
       "Using a Handheld Device While Driving (Infraction, $250 Fine)",
       "Improper Use of Horn (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrian in Crosswalk (Infraction, $250 Fine)",
       "Crossing a Double Yellow Line (Infraction, $250 Fine)",
       "Passing on the Shoulder (Infraction, $250 Fine)",
       "Towing Without a License (Infraction, $500 Fine)",
       "Move Over Law (Infraction, $250 Fine)",
       "Illegally Parked in a No Parking Zone (Infraction, $250 Fine)",
       "Failure to Pay for Parking Meter (Infraction, $250 Fine)",
       "Blocking a Driveway (Infraction, $250 Fine)",
       "Blocking a Crosswalk (Infraction, $250 Fine)",
       "Facing the Wrong Way (Infraction, $250 Fine)",
       "Bus Stop Violation (Infraction, $250 Fine)",
       "Blocking an Intersection (Infraction, $250 Fine)",
       "Parking Within 15 Feet of a Fire Station Driveway (Infraction, $250 Fine)",
       "Blocking Railroad Crossing (Infraction, $250 Fine)",
       "Parking on a Sidewalk Median or Divider (Infraction, $250 Fine)",
       "Unregistered Vehicle (Infraction, $250 Fine)",
       "Towing Without a Valid Operator's License (Infraction, $500 Fine)",
       "Failure to Signal (Infraction, $250 Fine)",
       "Failure to Yield to Pedestrians (Infraction, $250 Fine)",
       "Blocking Emergency Access Lanes (Infraction, $250 Fine)",
       "Expired Insurance (Infraction, $250 Fine)",
       "Fictitious Plate (Infraction, $250 Fine)",
       "Prohibited Underglow Lighting (Infraction, $250 Fine)",
       "Tailgating (Infraction, $250 Fine)",
       "Plate Violation (Infraction, $250 Fine)",
       "Operating a Vehicle While Using a Miscellaneous Object (Infraction, $500 Fine)",
       "Occupying a Side of the Freeway (Infraction, $250 Fine)",
       "Parking in an Alley Way (Infraction, $250 Fine)",
       "Unlawful Riding in a Vehicle (Infraction, $500 Fine)",
       "Driving Under the Influence (DUI) (Felony, 7 Months - $3,000 Fine)",
       "Hit and Run (Felony, 7 Months - $3,000 Fine)",
       "Street Racing (Felony, 7 Months - $3,000 Fine)",
       "Fleeing/Attempting to Elude (Felony, 7 Months - $3,000 Fine)",
       "Possession of a Stolen Vehicle (Felony, 7 Months - $3,000 Fine)",
       "Felony Speeding (Felony, 9 Months - $6,000 Fine)",
       "Grand Theft Auto (Felony, 7 Months - $6,000 Fine)",
       "Assault (Misdemeanor, 7 Months - $3,000 Fine)",
       "Battery (Misdemeanor, 7 Months - $3,000 Fine)",
       "Reckless Endangerment (Misdemeanor, 4 Months - $1,000 Fine)",
       "Stalking (Misdemeanor, 7 Months - $3,000 Fine)",
       "Robbery (Felony, 15 Months - $6,000 Fine)",
       "Homicide (Felony, 18 Months - $10,000 Fine)",
       "Domestic Violence (Felony, 15 Months - $6,000 Fine)",
       "Kidnapping (Felony, 18 Months - $10,000 Fine)",
       "Aggravated Assault (Felony, 18 Months - $10,000 Fine)",
       "Terroristic Threats (Felony, 7 Months - $3,000 Fine)",
       "Vehicular Manslaughter (Felony, 18 Months - $10,000 Fine)",
       "Attempted Murder of a Government Official (Felony, 18 Months - $6,000 Fine)",
       "Brandishing a Firearm in Public (Felony, 15 Months - $6,000 Fine)",
       "Assault of a Peace Officer (Felony, 15 Months - $6,000 Fine)",
       "Attempted Murder (Felony, 18 Months - $10,000 Fine)",
       "Armed Robbery (Felony, 18 Months - $9,000 Fine)",
       "Aggravated Battery (Felony, 15 Months - $6,000 Fine)",
       "Battery on a Law Enforcement Officer (Felony, 15 Months - $6,000 Fine)",
       "Second-Degree Murder (Felony, 15 Months - $6,000 Fine)",
       "Capital Murder (Felony, 15 Months - $6,000 Fine)",
       "Carjacking (Felony, 15 Months - $6,000 Fine)",
       "Solicitation to Commit Murder (Felony, 9 Months - $10,000 Fine)",
       "Obstructing Justice (Felony, 7 Months - $3,000 Fine)",
       "Possession of Assault Weapon (Felony, 7 Months - $2,250 Fine)",
       "Brandishing a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Using a Weapon While Intoxicated (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Secure a Firearm (Misdemeanor, 7 Months - $3,000 Fine)",
       "Carrying a Loaded Firearm in Public (Misdemeanor, 7 Months - $3,000 Fine)",
       "Negligent Use of a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
       "Possession of a Firearm Without a License (Misdemeanor, 7 Months - $3,000 Fine)",
       "Failure to Report Lost/Stolen Firearm (Misdemeanor, 4 Months - $1,000 Fine)",
       "Firearm in a Restricted Zone (Misdemeanor, 4 Months - $1,000 Fine)",
       "Carrying a Concealed Weapon Without Permit (Felony, 15 Months - $6,000 Fine)",
       "Illegal Sale of Firearms (Felony, 15 Months - $6,000 Fine)",
       "Unlawful Discharge of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Prohibited Weapon (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Weapon in a Restricted Area (Felony, 15 Months - $6,000 Fine)",
       "Trafficking Illegal Firearms (Felony, 15 Months - $6,000 Fine)",
       "Modifying a Firearm Illegally (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Firearm Without a Serial Number (Felony, 15 Months - $6,000 Fine)",
       "Possession of a Stolen Firearm (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of a Firearm (Felony, 15 Months - $6,000 Fine)",
       "Open Carry (Felony, 7 Months - $3,000 Fine)",
       "Reckless Firearm Discharge (Felony, 15 Months - $6,000 Fine)",
       "Felon in Possession of Deadly Weapon (Felony, 15 Months - $6,000 Fine)",
       "Discharge of a Firearm in City Limits (Felony, 15 Months - $6,000 Fine)",
       "Unserialized (\"Ghost\") Firearm (Felony, 15 Months - $6,000 Fine)",
       "Carrying Firearm While Masked (Felony, 15 Months - $6,000 Fine)",
       "Undetectable Firearm (Felony, 15 Months - $6,000 Fine)",
       "Sale to Prohibited Person (Felony, 15 Months - $6,000 Fine)",
       "Straw Purchase of Firearm (Felony, 15 Months - $6,000 Fine)",
       "Possession of an Unregistered Firearm (Felony, 9 Months)",
       "Illegal Transfer of a Firearm (Felony, 12 Months - $6,000 Fine)",
       "Possession of Ammunition by a Felon (Felony, 9 Months - $4,000 Fine)",
       "Possession of Explosive Device(s) (Felony, 18 Months - $8,000 Fine)",
       "Carrying a Firearm While Being Underage (Felony, 9 Months - $2,000 Fine)",
       "Possession of a Weapon in Commission of a Crime (Felony, 12 Months - $6,000 Fine)",
       "Possession of an Illegal Firearm Modification (Felony, 12 Months - $1,200 Fine)",
       "Embezzlement (Felony, 11 Months - $6,000 Fine)",
       "Fraud (Felony, 5 Months - $3,000 Fine)",
       "Tax Evasion (Felony, 5 Months - $3,000 Fine)",
       "Money Laundering (Felony, 5 Months - $3,000 Fine)",
       "Insider Trading (Felony, 5 Months - $3,000 Fine)",
       "Forgery (Felony, 5 Months - $3,000 Fine)",
       "Cybercrime (Felony, 5 Months - $3,000 Fine)",
       "Healthcare Fraud (Felony, 5 Months - $3,000 Fine)",
       "Ponzi Scheme (Felony, 5 Months - $3,000 Fine)",
       "Counterfeiting (Felony, 5 Months - $3,000 Fine)",
       "Corporate Espionage (Felony, 5 Months - $3,000 Fine)",
       "Animal Abuse and Cruelty (Misdemeanor, 4 Months - $1,000 Fine)",
       "Possession of Illegally Taken Wildlife (Misdemeanor, 4 Months - $1,000 Fine)",
       "Importation of Restricted Animals (Misdemeanor, 4 Months - $1,000 Fine)",
       "Exceeding Daily Catch Limits (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Out of Season or in Protected Areas (Misdemeanor, 4 Months - $1,000 Fine)",
       "Sale of Illegally Taken Fish (Misdemeanor, 4 Months - $1,000 Fine)",
       "Endangered Species Violation (Misdemeanor, 4 Months - $1,000 Fine)",
       "Using Illegal Fishing Gear or Methods (Misdemeanor, 4 Months - $1,000 Fine)",
       "Hunting Without a License (Infraction, $250 Fine)"
      ]
     },
     {
      "id": "count",
      "label": "Count",
      "type": "text",
      "placeholder": "1",
      "width": "narrow"
     }
    ],
    "check": {
     "id": "",
     "label": ""
    },
    "when": {
     "field": "teuType",
     "is": [
      "Bicycle Patrol Unit Report"
     ]
    }
   },
   {
    "type": "longtext",
    "id": "bpNotes",
    "title": "NOTES",
    "maxLength": 2000,
    "when": {
     "field": "teuType",
     "is": [
      "Bicycle Patrol Unit Report"
     ]
    }
   }
  ],
  "example": {
   "values": {
    "teuType": "Traffic Stop Report",
    "teuRank": "TEU Officer",
    "teuBadge": "L-108",
    "teuDept": "LSPD",
    "teuTime": "14:30",
    "teuLoc": "Strawberry Avenue & Davis",
    "teuWeather": "Clear",
    "teuRoad": "Dry",
    "tsName": "Phil Cantoon",
    "tsId": "SA-1029384",
    "tsDob": "1991-04-12",
    "tsAddr": "14 Alta Street",
    "tsLic": "Valid",
    "tsMake": "Bravado",
    "tsModel": "Buffalo",
    "tsColor": "Black",
    "tsPlate": "6ABC123",
    "tsReg": "Valid",
    "tsReason": "Speeding",
    "tsPosted": "50",
    "tsRecorded": "74",
    "tsDevice": "Radar gun",
    "tsCal": "Current",
    "tsObs": "Driver was cooperative and admitted to running late for work.",
    "tsAction": "Citation Issued",
    "tsFine": "$250",
    "tsPoints": "2"
   },
   "repeaters": {
    "tsCharges": [
     {
      "charge": "Speeding (Infraction, $250 Fine)",
      "count": "1"
     }
    ]
   }
  }
 }
];
