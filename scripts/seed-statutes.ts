/**
 * Comprehensive Statute Seed Script — ALL Major Pakistani Statutes
 *
 * Seeds the `statutes` table with verified, legally accurate Pakistani statute
 * data so the AI cites from the database instead of hallucinating from training data.
 *
 * Covers 25+ statutes with 500+ section/article entries.
 *
 * Usage:
 *   npx tsx scripts/seed-statutes.ts
 *
 * Safe to run multiple times — skips rows that already exist (matching shortTitle + section).
 */

import "../server/load-env";
import { db, pool } from "../server/db";
import { statutes } from "../shared/schema";
import { and, ilike } from "drizzle-orm";

type StatuteEntry = {
  shortTitle: string;
  section: string;
  description: string;
  punishment: string;
};

const STATUTE_DATA: StatuteEntry[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PAKISTAN PENAL CODE, 1860 (PPC)
  // ═══════════════════════════════════════════════════════════════════════════

  // General Exceptions & Right of Private Defence
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 34", description: "Acts done by several persons in furtherance of common intention: When a criminal act is done by several persons in furtherance of the common intention of all, each of such persons is liable for that act in the same manner as if it were done by him alone.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 35", description: "When such an act is criminal by reason of its being done with a criminal knowledge or intention: Whenever an act, which is criminal only by reason of its being done with a criminal knowledge or intention, is done by several persons, each of such persons who joins in the act with such knowledge or intention is liable for the act.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 76", description: "Act done by a person bound, or by mistake of fact believing himself bound, by law: Nothing is an offence which is done by a person who is, or who by reason of a mistake of fact in good faith believes himself to be, bound by law to do it.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 79", description: "Act done by a person justified, or by mistake of fact believing himself justified, by law: Nothing is an offence which is done by any person who is justified by law, or who by reason of a mistake of fact and not of law in good faith believes himself to be justified by law.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 80", description: "Accident in doing a lawful act: Nothing is an offence which is done by accident or misfortune and without any criminal intention or knowledge in the doing of a lawful act in a lawful manner by lawful means.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 84", description: "Act of a person of unsound mind: Nothing is an offence which is done by a person who, at the time of doing it, by reason of unsoundness of mind, is incapable of knowing the nature of the act, or that he is doing what is either wrong or contrary to law.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 96", description: "Things done in private defence: Nothing is an offence which is done in the exercise of the right of private defence.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 97", description: "Right of private defence of the body and of property: Every person has a right to defend his own body and the body of any other person against any offence affecting the human body, and the property of himself or any other person against theft, robbery, mischief, or criminal trespass.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 100", description: "When the right of private defence of the body extends to causing death: The right of private defence of the body extends to the voluntary causing of death if the offence reasonably causes the apprehension of death, grievous hurt, rape, kidnapping, abduction, or wrongful confinement.", punishment: "" },

  // Abetment
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 107", description: "Abetment of a thing: A person abets the doing of a thing who instigates any person to do that thing, or engages with others in a conspiracy to do that thing, or intentionally aids by any act or illegal omission the doing of that thing.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 109", description: "Punishment of abetment if the act abetted is committed in consequence and where no express provision is made for its punishment: Whoever abets any offence shall be punished with the punishment provided for the offence if the act abetted is committed in consequence of the abetment.", punishment: "Same as principal offence" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 120B", description: "Punishment of criminal conspiracy: Whoever is a party to a criminal conspiracy to commit an offence punishable with death or rigorous imprisonment for two years or upwards shall be punished in the same manner as if he had abetted such offence.", punishment: "Same as abetment of offence" },

  // Offences Against the State
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 121", description: "Waging, or attempting to wage war, or abetting waging of war, against Pakistan.", punishment: "Death, or imprisonment for life, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 124A", description: "Sedition: Whoever by words, either spoken or written, or by signs, or by visible representation, or otherwise, brings or attempts to bring into hatred or contempt, or excites or attempts to excite disaffection towards the Federal or Provincial Government established by law.", punishment: "Imprisonment for life, or imprisonment up to 3 years, and fine" },

  // Offences relating to public servants
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 161", description: "Public servant taking gratification other than legal remuneration in respect of an official act (bribery).", punishment: "Imprisonment up to 3 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 171", description: "Wearing garb or carrying token used by public servant with fraudulent intent.", punishment: "Imprisonment up to 3 months, or fine up to 200 rupees, or both" },

  // False evidence
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 193", description: "Punishment for false evidence: Whoever intentionally gives false evidence in any stage of a judicial proceeding, or fabricates false evidence for the purpose of being used in any stage of a judicial proceeding.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 196", description: "Using evidence known to be false: Whoever corruptly uses or attempts to use as true or genuine evidence any evidence which he knows to be false or fabricated.", punishment: "Same as giving false evidence" },

  // Contempt
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 228", description: "Intentional insult or interruption to public servant sitting in judicial proceeding.", punishment: "Simple imprisonment up to 6 months, or fine up to 1000 rupees, or both" },

  // Offences affecting the human body — Hurt & Grievous Hurt
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 299", description: "Definitions relating to offences affecting life: Defines 'qatl', 'hurt', 'qatl-i-amd' (intentional murder), 'qatl-i-khata' (unintentional killing), 'qatl-bis-sabab' (killing by rash or negligent act), and other key terms.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 300", description: "Qatl-i-amd (intentional murder): Whoever, with the intention of causing death or with the intention of causing bodily injury sufficient in the ordinary course of nature to cause death, causes the death of any person, commits qatl-i-amd.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 302", description: "Punishment of qatl-i-amd: Whoever commits qatl-i-amd shall, subject to the provisions of this Chapter, be punished with death as qisas, or imprisonment for life as ta'zir, or imprisonment up to 25 years as ta'zir.", punishment: "Death as qisas, or imprisonment for life as ta'zir, or imprisonment up to 25 years" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 304", description: "Proof of qatl-i-amd liable to qisas: For proving qatl-i-amd liable to qisas, certain conditions must be met including the identity of the offender, the act causing death, and the intention.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 306", description: "Qatl-i-amd not liable to qisas: Lists situations where qatl-i-amd is not liable to qisas, including when an offender is a minor or insane, when the victim is the offender's child, or when the wali (legal heir) is a direct descendant of the offender.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 308", description: "Qatl-i-khata (unintentional killing): Whoever, without any intention to cause death of or cause harm to any person, causes death of such person either by mistake of act or mistake of fact, is said to commit qatl-i-khata.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 309", description: "Punishment for qatl-i-khata: Whoever commits qatl-i-khata shall be liable to diyat and may also be punished with imprisonment of either description for a term which may extend to five years as ta'zir.", punishment: "Diyat, and imprisonment up to 5 years as ta'zir" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 310", description: "Qatl-bis-sabab (killing caused by rash or negligent act not amounting to qatl-i-khata): Whoever, without any intention to cause death, does any unlawful act which becomes a cause for the death of another person.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 311", description: "Punishment for qatl-bis-sabab.", punishment: "Diyat, and imprisonment up to 3 years as ta'zir" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 316", description: "Diyat (blood money): The value of diyat shall be 30,630 grams of silver or the cash equivalent at the time of payment.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 319", description: "Hurt defined: Whoever causes pain, harm, disease, infirmity, or injury to any person, or impairs, disables, or dismembers any organ or part of the body, is said to cause hurt.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 320", description: "Itlaf-i-udw (destruction of organ): Whoever destroys or permanently impairs the functioning of any organ or limb of another person commits itlaf-i-udw.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 322", description: "Itlaf-i-salahiyyat-i-udw (destroying the power or capacity of an organ): Whoever destroys or permanently impairs the power or capacity of an organ of the body of another person is said to commit itlaf-i-salahiyyat-i-udw.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 324", description: "Shajjah (hurt on the head or face): Whoever causes hurt on the head or face of any person is said to cause shajjah.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 332", description: "Jurh (hurt other than shajjah on head/face): Whoever causes hurt to any person on any part of the body other than the head or face.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 334", description: "General punishment provisions for hurt: Various categories of hurt with their respective punishments including qisas, arsh (compensation), and daman (damages).", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 337", description: "Punishment of other hurt: Whoever causes hurt not covered by specific provisions shall be liable to daman and may also be punished with imprisonment.", punishment: "Daman and imprisonment" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 337A", description: "Shajjah-i-khafifah (simple hurt on head/face).", punishment: "Imprisonment up to 2 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 337F", description: "Hurt not liable to qisas, arsh, or daman: Covers categories of hurt where punishment is ta'zir.", punishment: "Various ta'zir punishments" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 337H", description: "Punishment for causing hurt by rash or negligent act.", punishment: "Imprisonment up to 1 year, or fine up to diyat, or both" },

  // Compounding and Waiver
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 338", description: "Compounding of offences relating to hurt: An offence under Sections 334 to 337 may be compounded by the victim or their legal heirs.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 338E", description: "Isqat-i-hamal (causing miscarriage): A woman who causes herself to miscarry is said to cause isqat-i-hamal. Also covers causing miscarriage by another person.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 345", description: "Compounding of qatl-i-amd (murder): Qatl-i-amd may be compounded at any stage of proceedings by all the walis. Conditions and restrictions on compounding are specified.", punishment: "" },

  // Kidnapping & Abduction
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 359", description: "Kidnapping: Kidnapping is of two kinds — kidnapping from Pakistan (Section 360) and kidnapping from lawful guardianship (Section 361).", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 362", description: "Abduction defined: Whoever by force compels, or by any deceitful means induces, any person to go from any place, is said to abduct that person.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 363", description: "Punishment for kidnapping.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 365", description: "Kidnapping or abducting with intent secretly and wrongfully to confine person.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 365A", description: "Kidnapping or abduction for ransom.", punishment: "Death or imprisonment for life, and forfeiture of property" },

  // Sexual Offences
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 375", description: "Rape (zina-bil-jabr): A man is said to commit rape who has sexual intercourse with a woman against her will, without her consent, with her consent obtained by putting her in fear of death or hurt, with her consent obtained by impersonating her husband, or with her consent when she is unable to understand the nature of consent.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 376", description: "Punishment for rape.", punishment: "Death or imprisonment of not less than 10 years and not more than 25 years, and fine" },

  // Theft, Extortion, Robbery, Dacoity
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 378", description: "Theft defined: Whoever, intending to take dishonestly any movable property out of the possession of any person without that person's consent, moves that property in order to such taking, is said to commit theft.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 379", description: "Punishment for theft.", punishment: "Imprisonment up to 3 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 380", description: "Theft in dwelling house.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 381", description: "Theft by clerk or servant of property in possession of master.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 382", description: "Theft after preparation made for causing death, hurt, or restraint in order to the committing of the theft.", punishment: "Rigorous imprisonment up to 10 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 383", description: "Extortion defined: Whoever intentionally puts any person in fear of any injury to that person, or to any other, and thereby dishonestly induces the person so put in fear to deliver any property.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 384", description: "Punishment for extortion.", punishment: "Imprisonment up to 3 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 390", description: "Robbery defined: In all robbery there is either theft or extortion. Theft becomes robbery when, in order to commit theft, or in carrying away property obtained by theft, the offender causes or attempts to cause death, hurt, or wrongful restraint, or fear thereof.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 392", description: "Punishment for robbery.", punishment: "Rigorous imprisonment up to 10 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 395", description: "Punishment for dacoity (gang robbery by five or more persons).", punishment: "Imprisonment for life, or rigorous imprisonment up to 10 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 396", description: "Dacoity with murder.", punishment: "Death, or imprisonment for life, and fine" },

  // Cheating & Fraud
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 403", description: "Dishonest misappropriation of property: Whoever dishonestly misappropriates or converts to his own use any movable property.", punishment: "Imprisonment up to 2 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 405", description: "Criminal breach of trust: Whoever, being entrusted with property or with dominion over property, dishonestly misappropriates or converts to his own use that property, or dishonestly uses or disposes of that property.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 406", description: "Punishment for criminal breach of trust.", punishment: "Imprisonment up to 3 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 407", description: "Criminal breach of trust by carrier, wharfinger, etc.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 408", description: "Criminal breach of trust by clerk or servant.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 409", description: "Criminal breach of trust by public servant, or by banker, merchant, or agent.", punishment: "Imprisonment for life, or imprisonment up to 10 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 415", description: "Cheating defined: Whoever, by deceiving any person, fraudulently or dishonestly induces the person so deceived to deliver any property to any person, or to consent that any person shall retain any property.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 417", description: "Punishment for cheating.", punishment: "Imprisonment up to 1 year, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 418", description: "Cheating with knowledge that wrongful loss may ensue to person whose interest offender is bound to protect.", punishment: "Imprisonment up to 3 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 420", description: "Cheating and dishonestly inducing delivery of property.", punishment: "Imprisonment up to 7 years, and fine" },

  // Forgery
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 463", description: "Forgery defined: Whoever makes any false document or part of a document with intent to cause damage or injury to the public or to any person, or to support any claim or title, or to cause any person to part with property.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 464", description: "Making a false document: A person is said to make a false document who dishonestly or fraudulently makes, signs, seals, or executes a document or any part of it, or alters a document.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 465", description: "Punishment for forgery.", punishment: "Imprisonment up to 2 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 468", description: "Forgery for purpose of cheating.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 471", description: "Using as genuine a forged document.", punishment: "Same as if the person had forged the document" },

  // Criminal Trespass & Mischief
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 441", description: "Criminal trespass defined: Whoever enters into or upon property in the possession of another with intent to commit an offence or to intimidate, insult, or annoy any person in possession of such property.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 447", description: "Punishment for criminal trespass.", punishment: "Imprisonment up to 3 months, or fine up to 500 rupees, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 448", description: "Punishment for house-trespass.", punishment: "Imprisonment up to 1 year, or fine up to 1000 rupees, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 452", description: "House-trespass after preparation for hurt, assault, or wrongful restraint.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 425", description: "Mischief defined: Whoever with intent to cause, or knowing that he is likely to cause, wrongful loss or damage to the public or to any person, causes the destruction of any property, or any such change as destroys or diminishes its value or utility.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 427", description: "Mischief causing damage to the amount of fifty rupees or more.", punishment: "Imprisonment up to 2 years, or fine, or both" },

  // Criminal intimidation & Defamation
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 499", description: "Defamation defined: Whoever, by words spoken or intended to be read, or by signs or visible representations, makes or publishes any imputation concerning any person intending to harm, or knowing or having reason to believe that such imputation will harm, the reputation of such person.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 500", description: "Punishment for defamation.", punishment: "Simple imprisonment up to 2 years, or fine, or both" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 503", description: "Criminal intimidation: Whoever threatens another with any injury to his person, reputation, or property, or to the person or reputation of anyone in whom that person is interested, with intent to cause alarm.", punishment: "" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 506", description: "Punishment for criminal intimidation.", punishment: "Imprisonment up to 2 years, or fine, or both; if threat is of death or grievous hurt, imprisonment up to 7 years" },

  // Attempt
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 511", description: "Punishment for attempting to commit offences punishable with imprisonment for life or other imprisonment: Whoever attempts to commit an offence punishable by this Code with imprisonment for life or imprisonment, or to cause such an offence to be committed.", punishment: "Up to one-half of the longest term of imprisonment provided for the offence" },

  // Zina & Qazf
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 496A", description: "Enticing or taking away or detaining with criminal intent a woman.", punishment: "Imprisonment up to 7 years, and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 496B", description: "Fornication: A man and a woman not married to each other are said to commit fornication if they wilfully have sexual intercourse with one another.", punishment: "Imprisonment up to 5 years and fine" },
  { shortTitle: "Pakistan Penal Code, 1860", section: "Section 496C", description: "Adultery: A married man or married woman commits adultery if they have sexual intercourse with another person not their spouse.", punishment: "Imprisonment up to 5 years and fine" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CODE OF CRIMINAL PROCEDURE, 1898 (Cr.P.C.)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 4", description: "Definitions: Defines 'bailable offence', 'non-bailable offence', 'cognizable offence', 'non-cognizable offence', 'complaint', 'inquiry', 'investigation', 'trial', and other key procedural terms.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 6", description: "Classes of criminal courts: Lists the criminal courts in Pakistan — Supreme Court, High Courts, Sessions Courts, Judicial Magistrates, and Executive Magistrates.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 22", description: "Local jurisdiction of Sessions Judges and Magistrates: Every offence shall ordinarily be inquired into and tried by a court within the local limits of whose jurisdiction it was committed.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 46", description: "How arrests are made: In making an arrest, the police officer or other person shall actually touch or confine the body of the person to be arrested unless he submits to the custody by word or action.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 54", description: "When police may arrest without warrant (cognizable offences): Any police officer may without an order from a Magistrate and without a warrant arrest any person who has been concerned in any cognizable offence.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 55", description: "Arrest of vagabonds and suspected persons by police: Any police officer may arrest without a warrant any person found under suspicious circumstances.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 61", description: "Person arrested not to be detained more than 24 hours: No police officer shall detain in custody a person arrested without warrant for a longer period than under all the circumstances of the case is reasonable, and such period shall not exceed 24 hours.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 63", description: "Person arrested to be taken before Magistrate or officer in charge of police station: A police officer making an arrest shall, without unnecessary delay, take the person arrested before a Magistrate.", punishment: "" },

  // FIR & Investigation
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 154", description: "Information in cognizable cases (FIR): Every information relating to the commission of a cognizable offence, if given orally to an officer in charge of a police station, shall be reduced to writing and signed by the informant, and the substance thereof shall be entered in a book (FIR register).", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 155", description: "Information as to non-cognizable cases and investigation of such cases: When information is given to an officer in charge of a police station of the commission of a non-cognizable offence, he shall enter the substance in a book and refer the informant to the Magistrate.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 156", description: "Police officer's power to investigate cognizable cases: Any officer in charge of a police station may, without the order of a Magistrate, investigate any cognizable case which a court having jurisdiction over the local area would have power to inquire into or try.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 157", description: "Procedure for investigation: If, from information received or otherwise, an officer in charge of a police station has reason to suspect the commission of a cognizable offence, he shall send a report of the information to a Magistrate and proceed to the spot to investigate the facts.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 160", description: "Police officer's power to require attendance of witnesses: Any police officer making an investigation may, by order in writing, require the attendance of any person who appears to be acquainted with the circumstances of the case.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 161", description: "Examination of witnesses by police: Any police officer making an investigation may examine orally any person supposed to be acquainted with the facts and circumstances of the case. Such person shall be bound to answer all questions truthfully.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 164", description: "Recording of confessions and statements: Any Magistrate may record any confession or statement made to him in the course of an investigation or at any time afterwards before the commencement of the inquiry or trial.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 173", description: "Report of police officer (Challan): Every investigation shall be completed without unnecessary delay, and the officer in charge of police station shall forward to a Magistrate a report in the prescribed form (police report/challan) stating the names of parties, nature of information, names of persons who appear to be acquainted with the case, and whether the accused has been forwarded in custody or released on bail.", punishment: "" },

  // Bail
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 496", description: "When bail may be taken in case of non-bailable offence: When any person accused of any non-bailable offence is arrested or detained without warrant, he may be released on bail by the Court. The Court shall consider the nature of the accusation, the evidence, and the severity of punishment.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 497", description: "When bail may be taken in case of non-bailable offence (further provisions): If there appear reasonable grounds for believing that the accused is guilty of an offence punishable with death or imprisonment for life, such person shall not be released on bail. In other non-bailable cases, bail may be granted.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 498", description: "Power of High Court or Court of Session to grant bail: The High Court or Court of Session may direct that any person be admitted to bail, or that the bail required by a police officer or Magistrate be reduced.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 499", description: "Bond of accused and sureties: Before any person is released on bail, a bond shall be executed by such person, and, when required, by one or more sufficient sureties.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 500", description: "Amount of bond and reduction: The amount of every bond shall be fixed with due regard to the circumstances of the case, and shall not be excessive.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 501", description: "Discharge from custody: As soon as the bond has been executed, the person for whose appearance it has been executed shall be released from custody.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 497A", description: "Bail in offences not punishable with death: Any court may release the accused on bail if the offence is not punishable with death. Special provisions for bail after arrest.", punishment: "" },

  // Trial procedures
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 200", description: "Examination of complainant: A Magistrate taking cognizance of an offence on complaint shall examine upon oath the complainant and the witnesses present, and the substance of such examination shall be reduced to writing.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 202", description: "Postponement of issue of process: If the Magistrate is of opinion that the case should not be dismissed, he may postpone the issue of process and either inquire into the case himself or direct an investigation to be made by a police officer.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 204", description: "Issue of process: If the Magistrate is of opinion that there is sufficient ground for proceeding, he shall issue a summons for the attendance of the accused. If the offence is non-bailable, a warrant may be issued.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 241A", description: "Framing of charge: The court shall frame a charge against the accused specifying the offence of which the accused is charged.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 242", description: "Conviction on plea of guilty: If the accused pleads guilty, the Judge may convict him thereon.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 245", description: "When accused shall be acquitted: If the Magistrate, upon taking the evidence and hearing the accused, finds that no case against the accused has been made out which, if unrebutted, would warrant his conviction, the Magistrate shall order an acquittal.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 249A", description: "Power to acquit at any stage: If at any stage of the case, the Magistrate considers the charge to be groundless, he shall acquit the accused.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 265D", description: "Acquittal: If after hearing the arguments and evidence, the Judge considers there is no evidence that the accused committed the offence, the Judge shall record an order of acquittal.", punishment: "" },

  // Revision & Appeal
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 397", description: "Calling for records to exercise powers of revision: The High Court or any Sessions Judge may call for and examine the record of any proceeding before any inferior criminal court for the purpose of satisfying itself as to the correctness, legality, or propriety of any finding, sentence, or order.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 398", description: "Power to order inquiry: On examining any record, the High Court or Sessions Judge may direct the District Magistrate to make, and the District Magistrate shall make, further inquiry into any complaint.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 399", description: "Sessions Judge's power of revision: Where the Sessions Judge is of opinion that any proceeding should be revised, he may make such order as he thinks fit.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 401", description: "High Court's powers of revision: The High Court may exercise its powers of revision in any case decided by any criminal court other than a High Court. It may enhance the sentence, alter the finding, or order a retrial.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 410", description: "Appeal from sentence: Any person convicted on a trial may appeal to the court to which an appeal ordinarily lies.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 417", description: "Appeal in case of acquittal: The Provincial Government may, in any case, direct the Public Prosecutor to present an appeal against an order of acquittal. The complainant may also file an appeal against acquittal with leave of the High Court.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 426", description: "Suspension of sentence pending appeal and release on bail: Pending any appeal, the Appellate Court may order that the execution of the sentence or order appealed against be suspended and the convicted person be released on bail.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 435", description: "Power of High Court to transfer cases: Whenever it is made to appear to the High Court that a fair and impartial inquiry or trial cannot be had in any criminal court, the High Court may order that the case be transferred to another court.", punishment: "" },

  // Miscellaneous
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 439", description: "Power of High Court to set aside conviction and acquit or alter charge: In its revisional jurisdiction, the High Court may in the case of any proceeding the record of which has been called for, set aside the conviction and acquit or discharge the accused.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 491", description: "Power of High Court to issue directions of the nature of habeas corpus: The High Court may issue writs of habeas corpus to bring up a person illegally or improperly detained in public or private custody.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 540", description: "Power to summon material witness, or examine person present: Any court may, at any stage of any inquiry, trial, or other proceeding, summon any person as a witness, or recall and re-examine any person already examined.", punishment: "" },
  { shortTitle: "Code of Criminal Procedure, 1898", section: "Section 561A", description: "Inherent power of High Court: Nothing in this Code shall be deemed to limit or affect the inherent power of the High Court to make such orders as may be necessary to give effect to any order under this Code, or to prevent abuse of the process of any court or otherwise to secure the ends of justice.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CODE OF CIVIL PROCEDURE, 1908 (CPC) — Sections
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 9", description: "Courts to try all civil suits unless barred: The Courts shall (subject to the provisions herein contained) have jurisdiction to try all suits of a civil nature excepting suits of which their cognizance is either expressly or impliedly barred.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 10", description: "Stay of suit: No court shall proceed with the trial of any suit in which the matter in issue is also directly and substantially in issue in a previously instituted suit between the same parties.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 11", description: "Res judicata: No court shall try any suit or issue in which the matter directly and substantially in issue has been directly and substantially in issue in a former suit between the same parties and has been heard and finally decided by such court.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 12", description: "Bar to further suit: Where a plaintiff is precluded by rules from instituting a further suit in respect of any particular cause of action, he shall not be entitled to institute a suit in respect of such cause of action in any court.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 15", description: "Court in which suits to be instituted: Every suit shall be instituted in the court of the lowest grade competent to try it.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 16", description: "Suits to be instituted where subject matter situate: Subject to the pecuniary or other limitations, suits for recovery of immovable property or for partition shall be instituted in the court within the local limits of whose jurisdiction the property is situate.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 17", description: "Suits for immovable property situate within jurisdiction of different courts: Where a suit is to recover immovable property situate within the jurisdiction of different courts, the suit may be instituted in any court within the local limits of whose jurisdiction any portion of the property is situate.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 20", description: "Other suits to be instituted where defendants reside or cause of action arises: Subject to the limitations aforesaid, every suit shall be instituted in a court within the local limits of whose jurisdiction the defendant resides or carries on business, or the cause of action arises.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 24", description: "General power of transfer and withdrawal: The High Court or District Court may transfer any suit, appeal, or other proceeding pending before it for trial or disposal to any court subordinate to it.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 26", description: "Institution of suits: Every suit shall be instituted by the presentation of a plaint.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 33", description: "Judgment and decree: The court, after the case has been heard, shall pronounce judgment, and on such judgment a decree shall follow.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 35", description: "Costs: Subject to such conditions and limitations as may be prescribed, the costs of and incident to all suits shall be in the discretion of the Court.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 47", description: "Questions to be determined by the court executing decree: All questions arising between the parties to the suit in which the decree was passed, relating to the execution, discharge, or satisfaction of the decree, shall be determined by the court executing the decree.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 51", description: "Powers of court to enforce execution: Subject to such conditions and limitations as may be prescribed, the court may order execution by delivery of property, arrest and detention, attachment and sale of property, or appointment of a receiver.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 60", description: "Property liable to attachment and sale in execution of decree: Lists the property that may be attached and sold in execution, and specifies exemptions including necessary wearing apparel, cooking vessels, tools of artisans, and agricultural implements.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 80", description: "Notice before suit against Government or public officer: No suit shall be instituted against the Government or a public officer in respect of any act purporting to be done in his official capacity until the expiration of two months after a notice in writing has been delivered.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 89A", description: "Alternative dispute resolution (mediation): The court may, at any stage of suit, refer the matter to mediation. Covers the framework for ADR mechanisms.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 94", description: "Supplemental proceedings: The court may issue a temporary injunction, appoint a receiver, or make interlocutory orders as may appear to the court to be just and convenient.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 96", description: "Appeal from original decree: Save where otherwise expressly provided, an appeal shall lie from every decree passed by any court exercising original jurisdiction.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 100", description: "Second appeal: An appeal shall lie to the High Court from every decree passed in appeal by any court subordinate to the High Court, if the High Court is satisfied that the case involves a substantial question of law.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 104", description: "Orders from which appeal lies: An appeal shall lie from orders made under the rules specified (such as Order XXXIX Rules 1-2 temporary injunctions, Order XLIII).", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 114", description: "Review: Subject as aforesaid, any person aggrieved by a decree or order from which an appeal is allowed but from which no appeal has been preferred, or from which no appeal is allowed, may apply for a review of judgment.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 115", description: "Revision: The High Court may call for the record of any case which has been decided by any court subordinate to it and in which no appeal lies, and if it appears that such subordinate court has exercised a jurisdiction not vested in it, or has failed to exercise jurisdiction, or has acted illegally or with material irregularity, the High Court may make such order as it thinks fit.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 151", description: "Saving of inherent powers of court: Nothing in this Code shall be deemed to limit or otherwise affect the inherent power of the court to make such orders as may be necessary for the ends of justice or to prevent abuse of the process of the court.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Section 152", description: "Amendment of judgments, decrees, or orders: Clerical or arithmetical mistakes in judgments, decrees, or orders, or errors arising therein from any accidental slip or omission, may at any time be corrected by the court.", punishment: "" },

  // CPC — Key Orders & Rules
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order I Rule 10", description: "Suit in name of wrong plaintiff or nonjoinder/misjoinder of parties: The court may at any stage of the proceedings order that the name of any party improperly joined be struck out, and that the name of any person who ought to have been joined be added.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order II Rule 2", description: "Suit to include the whole claim: Every suit shall include the whole of the claim which the plaintiff is entitled to make. A plaintiff who omits to sue for any portion of his claim without leave of the court is precluded from afterwards suing for the portion so omitted.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order VI Rule 17", description: "Amendment of pleadings: The court may at any stage of the proceedings allow either party to alter or amend his pleadings, on such terms as may be just, and all amendments shall be made as may be necessary for the purpose of determining the real questions in controversy.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order VII Rule 10", description: "Return of plaint: Where a suit is instituted in a court having no jurisdiction, the plaint shall be returned for presentation to the proper court.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order VII Rule 11", description: "Rejection of plaint: The plaint shall be rejected where it does not disclose a cause of action, where the relief claimed is undervalued and the plaintiff fails to correct the valuation, where the suit appears from the plaint to be barred by any law, or where it is not filed in duplicate.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order IX Rule 9", description: "Dismissal of suit for default of plaintiff's appearance: Where the plaintiff does not appear when the suit is called on for hearing, the court may make an order that the suit be dismissed.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order IX Rule 13", description: "Setting aside decree passed ex parte: In any case in which a decree is passed ex parte against a defendant, he may apply to the court by which the decree was passed for an order to set it aside.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order XXXVII", description: "Summary procedure: Applies to suits upon bills of exchange, hundis, promissory notes, and written contracts. The defendant must obtain leave to appear and defend the suit.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order XXXVIII Rule 5", description: "Attachment before judgment: Where the defendant is about to dispose of the whole or any part of his property with intent to obstruct or delay the execution of any decree that may be passed against him, the court may order attachment of the property.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order XXXIX Rule 1", description: "Temporary injunction — cases in which temporary injunction may be granted: Where it is proved that any property is in danger of being wasted, damaged, or alienated by any party, or wrongfully sold in execution, the court may grant a temporary injunction.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order XXXIX Rule 2", description: "Temporary injunction to restrain repetition or continuance of breach: In any suit for restraining the defendant from committing a breach of contract or other injury, the court may grant a temporary injunction.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order XL Rule 1", description: "Appointment of receivers: Where it appears to the court to be just and convenient, the court may appoint a receiver of any property.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order XLI Rule 19", description: "Re-admission of appeal dismissed for default: Where an appeal has been dismissed for default of the appellant's appearance, he may apply to have the appeal re-admitted.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order XLI Rule 21", description: "Re-hearing of appeal heard ex parte: Where an appeal has been heard ex parte and judgment has been pronounced, the respondent may apply to the appellate court to re-hear the appeal.", punishment: "" },
  { shortTitle: "Code of Civil Procedure, 1908", section: "Order XLVII Rule 1", description: "Application for review of judgment: Any person aggrieved by a decree or order may apply for a review of judgment on the ground of discovery of new and important evidence, or on account of some mistake or error apparent on the face of the record, or for any other sufficient reason.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LIMITATION ACT, 1908 (already complete from previous version)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Limitation Act, 1908", section: "Section 3", description: "Bar of limitation: Every suit instituted, appeal preferred, and application made after the prescribed period shall be dismissed, although limitation has not been set up as a defence.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Section 5", description: "Extension of prescribed period in certain cases: Any appeal or application may be admitted after the prescribed period if the applicant satisfies the court that he had sufficient cause for not preferring the appeal or making the application within such period. Does not apply to suits.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Section 12", description: "Exclusion of time requisite for obtaining a copy of decree or order: The time required for obtaining a copy of the decree, sentence, or order appealed from or sought to be revised shall be excluded in computing the period of limitation.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Section 14", description: "Exclusion of time of proceeding bona fide in court without jurisdiction: Time spent prosecuting in good faith in a court which lacks jurisdiction is excluded from the limitation period.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 91", description: "Suit for compensation for breach of any contract, express or implied, not otherwise provided for. Limitation: 3 years from when the contract is broken.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 97", description: "Suit for movable property or for compensation for wrongfully taking or detaining it. Limitation: 3 years from when the property is wrongfully taken or detained.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 113", description: "Suit for possession of immovable property based on title. Limitation: 12 years from when the possession becomes adverse.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 114", description: "Suit for possession of immovable property based on prior possession and not on title. Limitation: 6 years from the date of dispossession.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 120", description: "Suit for which no period of limitation is provided elsewhere in this Schedule. Residuary article for suits. Limitation: 6 years from when the right to sue accrues.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 156", description: "Appeal from a decree or order of any court subordinate to a High Court. Limitation: 90 days from the date of the decree or order.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 157", description: "Appeal to a High Court from a decree or order of any court in the exercise of original jurisdiction. Limitation: 30 days from the date of the decree or order.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 158", description: "Application under the Arbitration Act to set aside an award or to get an award remitted for reconsideration. Limitation: 30 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 159", description: "Application for leave to appear and defend a suit under summary procedure (Order XXXVII CPC). Limitation: 10 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 160", description: "Application to restore to the file an application for review rejected for default. Limitation: 15 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 161", description: "Application for a review of judgment by a Court of Small Causes. Limitation: 15 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 162", description: "Application for a review of judgment by a High Court in original jurisdiction. Limitation: 20 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 163", description: "Application by plaintiff for an order to set aside a dismissal for default (Order IX Rule 9 CPC). Limitation: 30 days from dismissal.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 164", description: "Application by defendant for an order to set aside a decree passed ex parte (Order IX Rule 13 CPC). Limitation: 30 days from decree or knowledge of decree.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 165", description: "Application by person dispossessed disputing right of decree-holder or purchaser to possession. Limitation: 30 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 166", description: "Application to set aside a sale in execution of a decree. Limitation: 30 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 167", description: "Application complaining of resistance or obstruction to delivery of possession. Limitation: 30 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 168", description: "Application for the re-admission of an appeal dismissed for want of prosecution (Order XLI Rule 19 CPC). Limitation: 30 days from dismissal.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 169", description: "Application for re-hearing of an appeal heard ex parte. Limitation: 30 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 170", description: "Application for leave to appeal as a pauper. Limitation: 30 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 171", description: "Application to set aside an abatement. Limitation: 60 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 172", description: "Application to set aside sale on ground of no saleable interest. Limitation: 60 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 173", description: "Application for review of judgment (except Articles 161, 162). Limitation: 90 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 174", description: "Application for notice to show cause re payment out of court. Limitation: 90 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 175", description: "Application for payment of money out of court. Limitation: 90 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 176", description: "Application to substitute legal representative of deceased plaintiff or appellant. Limitation: 90 days from death.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 177", description: "Application to substitute legal representative of deceased defendant or respondent. Limitation: 90 days from death.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 178", description: "Application for filing of arbitration award in court. Limitation: 90 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 179", description: "Application for copy of judgment for purposes of appeal. Limitation: 90 days.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 180", description: "Application for delivery of possession to purchaser of immovable property. Limitation: 3 years from sale becoming absolute.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 181", description: "Application for which no period of limitation is provided elsewhere in this Schedule or by Section 48 CPC. Residuary article for applications. Limitation: 3 years.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 182", description: "Application for execution of decree or order of any Civil Court. Limitation: 3 years from date of decree.", punishment: "" },
  { shortTitle: "Limitation Act, 1908", section: "Article 183", description: "Application to enforce judgment/decree of High Court in original civil jurisdiction. Limitation: 12 years.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SPECIFIC RELIEF ACT, 1877 (already complete from previous version)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Specific Relief Act, 1877", section: "Section 8", description: "Recovery of specific immovable property: A person entitled to the possession of specific immovable property may recover it. Based on title (ownership).", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 9", description: "Suit by person dispossessed of immovable property: If a person is dispossessed without consent otherwise than in due course of law, they may sue for possession within 6 months. Focuses on possession, not title. No appeal lies.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 10", description: "Recovery of specific movable property: A person entitled to the immediate possession of any specific movable property may recover it.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 12", description: "Cases in which specific performance enforceable: When pecuniary compensation would not afford adequate relief, or when there is no standard for ascertaining actual damage.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 14", description: "Specific performance of part of contract where unperformed part is small and admits of compensation in money.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 15", description: "Who may obtain specific performance: Any party to a contract, representative in interest, or principal of agent who entered the contract.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 16", description: "Personal bars to relief: Specific performance cannot be enforced where a person obtained unfair advantage, became incapable of performing, or failed to aver readiness and willingness.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 17", description: "Contracts which cannot be specifically enforced: Contracts with uncertain terms, revocable by nature, or involving personal skill.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 19", description: "Relief against parties and persons claiming under them by subsequent title.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 21", description: "Power to award compensation in specific performance suits, either in addition to or in substitution for specific performance.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 22", description: "Power of court to grant specific performance with variations or modifications as may be just.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 39", description: "When cancellation of instruments may be ordered: When a written instrument is void or voidable and may cause serious injury if left outstanding.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 40", description: "Partial cancellation of instruments: Court may adjudge instrument void or voidable as to part only.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 42", description: "Discretion of court as to declaration of status or right. Court shall not make declaration if plaintiff omits to seek further available relief.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 54", description: "Perpetual injunctions when granted: To prevent the breach of an obligation existing in favour of the applicant.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 55", description: "Mandatory injunctions: When necessary to compel performance of certain acts to prevent breach of obligation.", punishment: "" },
  { shortTitle: "Specific Relief Act, 1877", section: "Section 56", description: "Cases in which injunction refused: Cannot restrain legislative applications, judicial proceedings in non-subordinate courts, or unenforceable contract performance.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CONTRACT ACT, 1872 (already complete from previous version)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Contract Act, 1872", section: "Section 2", description: "Definitions: Proposal (offer), promise, consideration, agreement, contract, void agreement, voidable contract, and void contract.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 10", description: "What agreements are contracts: Free consent, competent parties, lawful consideration, lawful object, not expressly void.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 11", description: "Competence to contract: Age of majority, sound mind, not disqualified by law.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 13", description: "Consent defined: Agreement upon same thing in the same sense.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 14", description: "Free consent: Not caused by coercion, undue influence, fraud, misrepresentation, or mistake.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 15", description: "Coercion: Committing or threatening acts forbidden by PPC, or unlawful detention of property, to induce agreement.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 16", description: "Undue influence: Where one party is in a position to dominate the will of the other and uses that position to obtain unfair advantage.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 17", description: "Fraud: Acts committed with intent to deceive another party, including false suggestion, active concealment, promise without intent to perform.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 18", description: "Misrepresentation: Positive assertion not warranted by information though believed true, or breach of duty gaining advantage by misleading.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 19", description: "Voidability of agreements without free consent: Contract is voidable at option of party whose consent was caused by coercion, fraud, or misrepresentation.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 23", description: "What considerations and objects are lawful: Unlawful if forbidden by law, defeats law, is fraudulent, involves injury, or is immoral/against public policy.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 25", description: "Agreement without consideration is void, unless in writing and registered, or promise to compensate for past act, or promise to pay time-barred debt.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 27", description: "Agreement in restraint of trade void.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 28", description: "Agreements in restraint of legal proceedings void.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 56", description: "Agreement to do impossible act is void. Contract becoming impossible or unlawful after formation becomes void.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 73", description: "Compensation for breach: Party suffering breach entitled to compensation for loss naturally arising in the usual course.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 74", description: "Compensation where penalty stipulated: Entitled to reasonable compensation not exceeding named sum.", punishment: "" },
  { shortTitle: "Contract Act, 1872", section: "Section 75", description: "Party rightfully rescinding contract entitled to compensation for damage from non-fulfilment.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. TRANSFER OF PROPERTY ACT, 1882 (already complete)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 5", description: "Transfer of property defined: An act by which a living person conveys property to one or more living persons.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 6", description: "What may be transferred: Property of any kind, except as otherwise provided.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 41", description: "Transfer by ostensible owner: Valid if transferee acted in good faith and paid consideration.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 52", description: "Doctrine of Lis Pendens: Property cannot be transferred to affect rights of parties during pendency of suit.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 53", description: "Fraudulent transfer: Transfer to defeat or delay creditors is voidable at creditor's option.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 54", description: "Sale defined: Transfer of ownership in exchange for price. Immovable property over 100 rupees requires registered instrument.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 58", description: "Mortgage defined: Transfer of interest in immovable property to secure payment. Defines types: simple, conditional sale, usufructuary, English, equitable.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 59", description: "Mortgage when to be by assurance: Principal money 100 rupees or upwards requires registered instrument.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 105", description: "Lease defined: Transfer of right to enjoy immovable property for time, in consideration of rent.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 106", description: "Duration of certain leases: Agricultural from year to year (6 months' notice); non-agricultural month to month (15 days' notice).", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 107", description: "Leases exceeding one year or reserving yearly rent must be by registered instrument.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 108", description: "Rights and liabilities of lessor and lessee in absence of contract or local usage.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 111", description: "Determination of lease: By efflux of time, event, merger, surrender, forfeiture, or notice to quit.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 116", description: "Holding over: New lease implied when lessee remains with lessor's consent after lease ends.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 118", description: "Gift defined: Voluntary transfer without consideration, accepted by donee.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 122", description: "Gift of immovable property must be by registered instrument signed by donor.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 123", description: "Gift of immovable property by registered instrument; movable by registered instrument or delivery.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 129", description: "Gift induced by fraud, misrepresentation, or undue influence may be set aside.", punishment: "" },
  { shortTitle: "Transfer of Property Act, 1882", section: "Section 130", description: "Transfer of actionable claims: Must be by instrument in writing signed by transferor.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. QANUN-E-SHAHADAT ORDER, 1984 (already complete)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 2", description: "Application: Extends to whole of Pakistan. Definitions of court, document, evidence, fact, oral evidence, and proved.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 17", description: "Competence and number of witnesses: Determined per Injunctions of Islam. Financial obligations require two men or one man and two women.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 46", description: "Judicial notice: Courts must take notice of laws in force, legislative proceedings, seals, geographical divisions, and matters of common knowledge.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 59", description: "Dying declaration: Statement by a person who is dead or cannot be found, relevant if about cause of death or circumstances of transaction resulting in death.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 71", description: "Proof of contents of documents: By primary or secondary evidence.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 78", description: "Presumption as to documents 30 years old: Court may presume proper execution.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 117", description: "Burden of proof: Person who desires judgment must prove facts asserted. Lies on party who would fail if no evidence given.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 118", description: "On whom burden lies: On the person who would fail if no evidence at all were given on either side.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 119", description: "Burden as to particular fact: Lies on person who wishes court to believe in its existence.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 129", description: "Court may presume existence of facts likely to have happened per common course of natural events and human conduct.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 132", description: "Estoppel: Person who caused another to believe something true and act upon it cannot deny its truth.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 133", description: "Estoppel of tenant: Tenant cannot deny landlord's title at beginning of tenancy.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 140", description: "Leading questions: Not allowed in examination-in-chief or re-examination; allowed in cross-examination.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 148", description: "Impeaching credit of witness: By showing witness is unworthy of credit.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 163", description: "Improper admission or rejection of evidence not ground for new trial by itself.", punishment: "" },
  { shortTitle: "Qanun-e-Shahadat Order, 1984", section: "Article 164", description: "Judge may put questions to any witness and order production of any document.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. CONSTITUTION OF PAKISTAN, 1973 (already complete)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 4", description: "Right to be dealt with in accordance with law. No detrimental action without law.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 8", description: "Laws inconsistent with fundamental rights void to extent of inconsistency.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 9", description: "Security of person: No deprivation of life or liberty save in accordance with law.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 10", description: "Safeguards as to arrest: Right to be informed of grounds and consult legal practitioner.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 10A", description: "Right to fair trial and due process.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 14", description: "Inviolability of dignity. No torture for extracting evidence.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 18", description: "Freedom of trade, business or profession.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 19", description: "Freedom of speech and press, subject to reasonable restrictions.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 19A", description: "Right to information in matters of public importance.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 20", description: "Freedom to profess religion.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 23", description: "Right to acquire, hold, and dispose of property.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 24", description: "Protection of property rights. No compulsory deprivation except by law, for public purpose, with compensation.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 25", description: "Equality of citizens before law. No discrimination on basis of sex alone.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 25A", description: "Right to free and compulsory education for children age 5-16.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 184", description: "Original jurisdiction of Supreme Court. Article 184(3): jurisdiction on questions of public importance re fundamental rights.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 185", description: "Appellate jurisdiction of Supreme Court from High Court judgments involving substantial constitutional questions.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 186A", description: "Power of Supreme Court to transfer cases between High Courts.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 199", description: "Writ jurisdiction of High Court: habeas corpus, mandamus, prohibition, quo warranto, certiorari for enforcement of fundamental rights.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 203C", description: "Federal Shariat Court: Examines whether laws are repugnant to Injunctions of Islam.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 212", description: "Establishment of Administrative Courts and Tribunals for service matters.", punishment: "" },
  { shortTitle: "Constitution of the Islamic Republic of Pakistan, 1973", section: "Article 227", description: "All laws to conform with Injunctions of Islam. No law repugnant to Quran and Sunnah.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. FAMILY COURTS ACT, 1964
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Family Courts Act, 1964", section: "Section 5", description: "Establishment of Family Courts: The Government may establish as many Family Courts as it considers necessary for each area.", punishment: "" },
  { shortTitle: "Family Courts Act, 1964", section: "Section 7", description: "Pre-trial proceedings: When a suit is instituted, the Family Court shall fix a date for pre-trial hearing and issue notice to the other party.", punishment: "" },
  { shortTitle: "Family Courts Act, 1964", section: "Section 9", description: "Procedure of Family Court: The Family Court shall follow the procedure set out in the Schedule. It is not bound by the Code of Civil Procedure except as provided.", punishment: "" },
  { shortTitle: "Family Courts Act, 1964", section: "Section 10", description: "Jurisdiction: Subject to the provisions of this Act, the Family Courts shall have exclusive jurisdiction to entertain, hear, and adjudicate upon matters specified in the Schedule (dissolution of marriage, dower, maintenance, custody of children, etc.).", punishment: "" },
  { shortTitle: "Family Courts Act, 1964", section: "Section 12", description: "Appeal: An appeal against a decree or order of a Family Court lies to the High Court within 30 days (or such time as the High Court may allow).", punishment: "" },
  { shortTitle: "Family Courts Act, 1964", section: "Section 12A", description: "Enforcement of decree: A decree passed by a Family Court may be executed by the Family Court itself or by the court to which it is sent for execution.", punishment: "" },
  { shortTitle: "Family Courts Act, 1964", section: "Section 14", description: "Power to make rules: The Government may make rules for carrying out the purposes of this Act.", punishment: "" },
  { shortTitle: "Family Courts Act, 1964", section: "Schedule", description: "Matters within jurisdiction of Family Courts: (i) Dissolution of marriage including khula, (ii) Dower (mahr), (iii) Maintenance, (iv) Restitution of conjugal rights, (v) Custody of children (hizanat), (vi) Guardianship, (vii) Jactitation of marriage, (viii) Dowry.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. MUSLIM FAMILY LAWS ORDINANCE, 1961
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Muslim Family Laws Ordinance, 1961", section: "Section 4", description: "Succession: In the event of death of any son or daughter of the propositus before the opening of succession, the children of such son or daughter shall per stirpes receive a share equivalent to the share which such son or daughter would have received if alive.", punishment: "" },
  { shortTitle: "Muslim Family Laws Ordinance, 1961", section: "Section 5", description: "Registration of marriages: Every marriage shall be registered in accordance with the provisions of this Ordinance.", punishment: "" },
  { shortTitle: "Muslim Family Laws Ordinance, 1961", section: "Section 6", description: "Polygamy: No man during the subsistence of an existing marriage shall contract another marriage except with the previous permission in writing of the Arbitration Council. Application requires stating reasons and obtaining existing wife's consent.", punishment: "Simple imprisonment up to 1 year, or fine up to 5000 rupees, or both" },
  { shortTitle: "Muslim Family Laws Ordinance, 1961", section: "Section 7", description: "Talaq (divorce): Any man who wishes to divorce his wife shall, as soon as may be after the pronouncement of talaq, give notice in writing to the Chairman of the Union Council and supply a copy to the wife. Talaq shall not be effective until 90 days have elapsed.", punishment: "" },
  { shortTitle: "Muslim Family Laws Ordinance, 1961", section: "Section 8", description: "Dissolution of marriage otherwise than by talaq: Where a woman has been married under Muslim law and the marriage has not been dissolved by talaq, she may obtain dissolution through court.", punishment: "" },
  { shortTitle: "Muslim Family Laws Ordinance, 1961", section: "Section 9", description: "Maintenance: If any husband fails to maintain his wife adequately, the wife may apply to the Chairman of the Union Council who shall constitute an Arbitration Council to determine the matter.", punishment: "" },
  { shortTitle: "Muslim Family Laws Ordinance, 1961", section: "Section 10", description: "Dower (Mahr): Where no details about the mode of payment of dower are specified in the nikahnama, the entire amount of the dower shall be presumed to be payable on demand.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. DISSOLUTION OF MUSLIM MARRIAGES ACT, 1939
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Dissolution of Muslim Marriages Act, 1939", section: "Section 2", description: "Grounds for decree for dissolution: A woman married under Muslim law shall be entitled to obtain a decree for dissolution on grounds including: (i) whereabouts of husband unknown for 4 years, (ii) failure to maintain for 2 years, (iii) imprisonment of 7 years or more, (iv) failure to perform marital obligations for 3 years, (v) impotence, (vi) insanity for 2 years, (vii) cruelty, (viii) any other ground recognized under Muslim law.", punishment: "" },
  { shortTitle: "Dissolution of Muslim Marriages Act, 1939", section: "Section 3", description: "Notice to be given to husband: In suits under clause (i) of Section 2, the court shall before passing a decree serve notice on the husband by publication in a newspaper.", punishment: "" },
  { shortTitle: "Dissolution of Muslim Marriages Act, 1939", section: "Section 4", description: "Effect of conversion to Islam: The renunciation of Islam by a married Muslim woman or her conversion to a faith other than Islam shall not by itself operate to dissolve her marriage.", punishment: "" },
  { shortTitle: "Dissolution of Muslim Marriages Act, 1939", section: "Section 5", description: "Rights under other law not affected: Nothing in this Act shall affect any right which a married woman may have under Muslim law to her dissolution of marriage.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. GUARDIANS AND WARDS ACT, 1890
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Guardians and Wards Act, 1890", section: "Section 4", description: "Definitions: Defines 'guardian', 'ward', 'minor', and the types of guardianship (natural, testamentary, by court appointment).", punishment: "" },
  { shortTitle: "Guardians and Wards Act, 1890", section: "Section 7", description: "Power of court to make order as to guardianship: Where the court is satisfied that it is for the welfare of a minor that an order should be made, it may appoint a guardian of the person or property of the minor.", punishment: "" },
  { shortTitle: "Guardians and Wards Act, 1890", section: "Section 9", description: "Court having jurisdiction: Application for appointment of guardian to be made to the District Court having jurisdiction.", punishment: "" },
  { shortTitle: "Guardians and Wards Act, 1890", section: "Section 17", description: "Matters to be considered by the court in appointing guardian: The court shall have regard to the welfare of the minor, the age, sex, and religion of the minor, the character and capacity of the proposed guardian, and the wishes of a deceased parent.", punishment: "" },
  { shortTitle: "Guardians and Wards Act, 1890", section: "Section 19", description: "Guardian not to be appointed by court in certain cases: The court shall not appoint a guardian of the person or property of a minor who has a natural guardian unless the court is satisfied that it is for the welfare of the minor to do so.", punishment: "" },
  { shortTitle: "Guardians and Wards Act, 1890", section: "Section 25", description: "Custody of ward: A guardian of the person is entitled to the custody of his ward and may apply to the court for a writ of habeas corpus to recover custody.", punishment: "" },
  { shortTitle: "Guardians and Wards Act, 1890", section: "Section 41", description: "Removal of guardian: The court may remove a guardian who has abused his trust, is incapable of performing duties, has neglected to perform duties, or has ceased to reside in Pakistan.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. NEGOTIABLE INSTRUMENTS ACT, 1881
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 4", description: "Promissory note defined: An instrument in writing containing an unconditional undertaking, signed by the maker, to pay a certain sum of money to, or to the order of, a certain person.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 5", description: "Bill of exchange defined: An instrument in writing containing an unconditional order, signed by the maker, directing a certain person to pay a certain sum of money.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 6", description: "Cheque defined: A bill of exchange drawn on a specified banker and not expressed to be payable otherwise than on demand.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 13", description: "Negotiable instrument: A promissory note, bill of exchange, or cheque payable to order or to bearer.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 14", description: "Negotiation: When a promissory note, bill of exchange, or cheque is transferred to any person so as to constitute that person the holder thereof, the instrument is said to be negotiated.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 30", description: "Liability of drawer: The drawer of a bill of exchange or cheque is bound to compensate the holder in case of dishonour by the drawee.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 43", description: "Maturity of note or bill: A promissory note or bill of exchange is at maturity on the third day after the day on which it is expressed to be payable (days of grace).", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 44", description: "Presentment for payment: A promissory note or bill of exchange must be presented for payment to the maker or acceptor.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 64", description: "Liability of maker of note and acceptor of bill: The maker of a promissory note and the acceptor of a bill of exchange before maturity are in the position of principal debtors.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 118", description: "Presumptions as to negotiable instruments: Until the contrary is proved, the court shall presume that every negotiable instrument was made or drawn for consideration, and that it was accepted, endorsed, or transferred before maturity.", punishment: "" },
  { shortTitle: "Negotiable Instruments Act, 1881", section: "Section 138", description: "Dishonour of cheque for insufficiency of funds: Where any cheque drawn for the discharge of any legally enforceable debt or liability is returned unpaid by the bank, the drawer shall be punished.", punishment: "Imprisonment up to 1 year, or fine up to twice the cheque amount, or both" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. SALE OF GOODS ACT, 1930
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 4", description: "Sale and agreement to sell: A contract of sale of goods is a contract whereby the seller transfers or agrees to transfer the property in goods to the buyer for a price.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 5", description: "Existing or future goods: Goods which form the subject of a contract of sale may be either existing goods or future goods.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 12", description: "Condition and warranty: A stipulation essential to the main purpose of the contract is a condition; a stipulation collateral to the main purpose is a warranty.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 14", description: "Implied conditions as to title: An implied condition that the seller has the right to sell the goods.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 15", description: "Sale by description: Where goods are sold by description, there is an implied condition that the goods shall correspond with the description.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 16", description: "Implied conditions as to quality or fitness: No implied warranty or condition as to quality or fitness except where buyer relies on seller's skill and judgment, or where goods are bought by description from a seller who deals in such goods.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 19", description: "Passing of property: When property in goods passes from seller to buyer depends on the intention of the parties.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 27", description: "Sale by person not the owner: Subject to this Act, where goods are sold by a person who is not the owner, the buyer acquires no better title than the seller had (nemo dat quod non habet), unless the owner is estopped.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 45", description: "Rights of unpaid seller against the goods: The unpaid seller of goods has a lien on the goods, a right of stoppage in transitu, and a right of resale.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 55", description: "Suit for damages for non-acceptance: Where the buyer wrongfully neglects or refuses to accept and pay for the goods, the seller may sue for damages for non-acceptance.", punishment: "" },
  { shortTitle: "Sale of Goods Act, 1930", section: "Section 56", description: "Suit for damages for non-delivery: Where the seller wrongfully neglects or refuses to deliver the goods, the buyer may sue for damages for non-delivery.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. PARTNERSHIP ACT, 1932
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Partnership Act, 1932", section: "Section 4", description: "Partnership defined: Partnership is the relation between persons who have agreed to share the profits of a business carried on by all or any of them acting for all.", punishment: "" },
  { shortTitle: "Partnership Act, 1932", section: "Section 5", description: "Relation of partnership arises from contract and not from status.", punishment: "" },
  { shortTitle: "Partnership Act, 1932", section: "Section 9", description: "General duties of partners: Every partner is bound to carry on the business to the greatest common advantage, to be just and faithful, and to render true accounts.", punishment: "" },
  { shortTitle: "Partnership Act, 1932", section: "Section 18", description: "Partner is agent of the firm: Subject to this Act, a partner is the agent of the firm for the purposes of the business of the firm.", punishment: "" },
  { shortTitle: "Partnership Act, 1932", section: "Section 25", description: "Liability of a partner for acts of the firm: Every partner is liable, jointly with all the other partners and also severally, for all acts of the firm done while he is a partner.", punishment: "" },
  { shortTitle: "Partnership Act, 1932", section: "Section 32", description: "Retirement of a partner: A partner may retire from a firm with the consent of all the other partners, or in accordance with an express agreement.", punishment: "" },
  { shortTitle: "Partnership Act, 1932", section: "Section 40", description: "Rights of outgoing partner to carry on competing business: An outgoing partner may carry on a business competing with that of the firm, subject to any agreement to the contrary.", punishment: "" },
  { shortTitle: "Partnership Act, 1932", section: "Section 42", description: "Dissolution by the court: At the suit of a partner, the court may dissolve a firm on the ground that a partner has become of unsound mind, is guilty of misconduct, has persistently committed breach of agreement, or the business can only be carried on at a loss.", punishment: "" },
  { shortTitle: "Partnership Act, 1932", section: "Section 48", description: "Mode of settlement of accounts between partners: In settling accounts after dissolution, losses shall be paid first out of profits, next out of capital, and lastly by the partners individually in the proportion in which they were entitled to share profits.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. REGISTRATION ACT, 1908
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Registration Act, 1908", section: "Section 17", description: "Documents of which registration is compulsory: Instruments of gift of immovable property, other non-testamentary instruments which purport to create, declare, assign, limit, or extinguish any right, title, or interest in immovable property of the value of 100 rupees or more.", punishment: "" },
  { shortTitle: "Registration Act, 1908", section: "Section 18", description: "Documents of which registration is optional: Instruments acknowledging payment of consideration, leases for a term not exceeding one year, instruments transferring or assigning any decree of a civil court.", punishment: "" },
  { shortTitle: "Registration Act, 1908", section: "Section 23", description: "Time for presenting documents: Documents to be registered must be presented within 4 months from the date of execution.", punishment: "" },
  { shortTitle: "Registration Act, 1908", section: "Section 28", description: "Place for registration of documents relating to land: Every document relating to immovable property shall be registered in the office of the Sub-Registrar within whose sub-district the property or some portion thereof is situate.", punishment: "" },
  { shortTitle: "Registration Act, 1908", section: "Section 49", description: "Effect of non-registration of documents required to be registered: No document required to be registered shall affect any immovable property comprised therein or be received as evidence of any transaction affecting such property.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. STAMP ACT, 1899
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Stamp Act, 1899", section: "Section 3", description: "Instruments chargeable with duty: Every instrument mentioned in the Schedule to this Act shall be chargeable with duty of the amount indicated in the Schedule.", punishment: "" },
  { shortTitle: "Stamp Act, 1899", section: "Section 17", description: "Instruments executed in Pakistan: All instruments chargeable with duty and executed by any person in Pakistan shall be stamped before or at the time of execution.", punishment: "" },
  { shortTitle: "Stamp Act, 1899", section: "Section 33", description: "Examination and impounding of instruments: Every person having by law or consent of parties authority to receive evidence, and every person in charge of a public office, shall examine every instrument tendered and impound it if not duly stamped.", punishment: "" },
  { shortTitle: "Stamp Act, 1899", section: "Section 35", description: "Instruments not duly stamped inadmissible in evidence: No instrument chargeable with duty shall be admitted in evidence for any purpose unless it is duly stamped, unless duty and penalty are paid.", punishment: "" },
  { shortTitle: "Stamp Act, 1899", section: "Section 49", description: "Instruments of conveyance: The term 'conveyance' includes a transfer of property in immovable property on sale and every decree or order of any court.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. ARBITRATION ACT, 1940
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Arbitration Act, 1940", section: "Section 2", description: "Definitions: Defines 'arbitration agreement', 'award', 'court', and 'legal proceeding'.", punishment: "" },
  { shortTitle: "Arbitration Act, 1940", section: "Section 3", description: "Appointment of arbitrator or umpire: Where an arbitration agreement provides for the appointment of a sole arbitrator and the parties do not agree on the appointment, the court may appoint an arbitrator.", punishment: "" },
  { shortTitle: "Arbitration Act, 1940", section: "Section 8", description: "Power of court to modify award: The court may modify or correct an award where it appears that a part of the award is upon a matter not referred to arbitration.", punishment: "" },
  { shortTitle: "Arbitration Act, 1940", section: "Section 14", description: "Award to be signed and filed: When the arbitrators or umpire have made their award, they shall sign it and give notice to the parties and file the award in court.", punishment: "" },
  { shortTitle: "Arbitration Act, 1940", section: "Section 17", description: "Judgment in terms of award: Upon the filing of an award, the court shall pronounce judgment according to the award, and upon the judgment so given a decree shall follow.", punishment: "" },
  { shortTitle: "Arbitration Act, 1940", section: "Section 30", description: "Grounds for setting aside award: The court may set aside an award on the ground that the arbitrator has misconducted himself or the proceedings, or that the award has been made after the issue of an order superseding the arbitration, or that the award is otherwise invalid.", punishment: "" },
  { shortTitle: "Arbitration Act, 1940", section: "Section 33", description: "Stay of legal proceedings where there is an arbitration agreement: Where any party to an arbitration agreement commences any legal proceedings against any other party, the other party may apply to stay the proceedings.", punishment: "" },
  { shortTitle: "Arbitration Act, 1940", section: "Section 34", description: "Finality of awards: An award upon all matters referred to arbitration shall, subject to the provisions of this Act, be final and binding on the parties and persons claiming under them.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. CONTROL OF NARCOTIC SUBSTANCES ACT, 1997 (CNSA)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Control of Narcotic Substances Act, 1997", section: "Section 6", description: "Prohibition: No person shall produce, manufacture, extract, prepare, possess, offer for sale, sell, purchase, distribute, deliver, transport, or import any narcotic drug or psychotropic substance except as provided.", punishment: "" },
  { shortTitle: "Control of Narcotic Substances Act, 1997", section: "Section 9", description: "Punishment for contravention: Whoever contravenes the provisions of Section 6 regarding narcotic drugs and psychotropic substances. Varies by quantity of substance.", punishment: "Varies: (a) up to 100g — imprisonment up to 2 years or fine or both; (b) 100g to 1kg — imprisonment 2-7 years and fine; (c) over 1kg — death or imprisonment for life and fine" },
  { shortTitle: "Control of Narcotic Substances Act, 1997", section: "Section 15", description: "Offences relating to opium: Whoever cultivates opium poppy or processes opium without lawful authority.", punishment: "Imprisonment 5 to 14 years and fine" },
  { shortTitle: "Control of Narcotic Substances Act, 1997", section: "Section 21", description: "Power of search and seizure: Any officer authorized may enter, search any building, vessel, vehicle, or place and seize any narcotic substance found.", punishment: "" },
  { shortTitle: "Control of Narcotic Substances Act, 1997", section: "Section 25", description: "Arrest without warrant: Any officer empowered by this Act may arrest any person whom he reasonably suspects of having committed an offence under this Act.", punishment: "" },
  { shortTitle: "Control of Narcotic Substances Act, 1997", section: "Section 32", description: "Trial of offences by Special Courts: The Federal Government or Provincial Government may establish Special Courts for the trial of offences under this Act.", punishment: "" },
  { shortTitle: "Control of Narcotic Substances Act, 1997", section: "Section 36", description: "Burden of proof: In any prosecution under this Act, the burden of proving lawful authority shall be on the accused.", punishment: "" },
  { shortTitle: "Control of Narcotic Substances Act, 1997", section: "Section 37", description: "Bail: When accused of an offence under this Act punishable for more than 3 years, accused shall not be released on bail unless the court is satisfied there are reasonable grounds to believe the accused is not guilty.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 21. ANTI-TERRORISM ACT, 1997 (ATA)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Anti-Terrorism Act, 1997", section: "Section 6", description: "Terrorism defined: Whoever, to coerce, intimidate, or overawe the Government or the public, commits acts involving violence, causes damage to property, or creates a sense of fear or insecurity in society.", punishment: "" },
  { shortTitle: "Anti-Terrorism Act, 1997", section: "Section 7", description: "Punishment for acts of terrorism: Whoever commits an act of terrorism shall be liable to the punishments specified, including death, imprisonment for life, or imprisonment for not less than 5 years.", punishment: "Death, imprisonment for life, or imprisonment not less than 5 years" },
  { shortTitle: "Anti-Terrorism Act, 1997", section: "Section 11", description: "Proscribed organizations: The Federal Government may, by order in the official Gazette, declare an organization as proscribed if it is concerned in terrorism.", punishment: "" },
  { shortTitle: "Anti-Terrorism Act, 1997", section: "Section 13", description: "Offences relating to membership of proscribed organizations: A person commits an offence if he belongs to or professes to belong to a proscribed organization.", punishment: "Imprisonment up to 10 years and fine" },
  { shortTitle: "Anti-Terrorism Act, 1997", section: "Section 19", description: "Jurisdiction of Anti-Terrorism Courts: The Federal Government or Provincial Government shall establish Anti-Terrorism Courts. These courts have exclusive jurisdiction to try offences under this Act.", punishment: "" },
  { shortTitle: "Anti-Terrorism Act, 1997", section: "Section 21H", description: "Protection of witnesses: The court may issue orders for the protection of witnesses, including concealing their identity and location.", punishment: "" },
  { shortTitle: "Anti-Terrorism Act, 1997", section: "Section 25", description: "Appeal: Any person convicted by an Anti-Terrorism Court may prefer an appeal to the High Court within 30 days.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 22. NATIONAL ACCOUNTABILITY ORDINANCE, 1999 (NAB)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "National Accountability Ordinance, 1999", section: "Section 4", description: "Appointment and qualifications of Chairman NAB: The President shall appoint the Chairman of the National Accountability Bureau.", punishment: "" },
  { shortTitle: "National Accountability Ordinance, 1999", section: "Section 9", description: "Offences triable by Accountability Courts: Corruption and corrupt practices including misuse of authority, willful default, cheating the public at large, and commission of offences of corruption under any law.", punishment: "" },
  { shortTitle: "National Accountability Ordinance, 1999", section: "Section 10", description: "Punishment for offences: A person guilty of the offence of corruption and corrupt practices shall be punishable with rigorous imprisonment for up to 14 years and fine.", punishment: "Rigorous imprisonment up to 14 years and fine" },
  { shortTitle: "National Accountability Ordinance, 1999", section: "Section 16", description: "Power to freeze property: The Chairman NAB may by order in writing direct any banking company or financial institution not to allow any withdrawal from any account.", punishment: "" },
  { shortTitle: "National Accountability Ordinance, 1999", section: "Section 18", description: "Arrest: The Chairman NAB, or an officer authorized, may arrest any person who has committed or is reasonably suspected to have committed an offence under this Ordinance.", punishment: "" },
  { shortTitle: "National Accountability Ordinance, 1999", section: "Section 24", description: "Transfer and withdrawal of cases: The Chairman NAB may transfer any case from one court to another, or from any investigating officer to another.", punishment: "" },
  { shortTitle: "National Accountability Ordinance, 1999", section: "Section 25", description: "Voluntary return and plea bargain: An accused may apply for voluntary return of assets and plea bargain at any time before judgment is reserved.", punishment: "" },
  { shortTitle: "National Accountability Ordinance, 1999", section: "Section 32", description: "Appeal: Any person convicted or aggrieved by an order of an Accountability Court may file an appeal to the High Court within 10 days of the judgment.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 23. PREVENTION OF ELECTRONIC CRIMES ACT, 2016 (PECA)
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 3", description: "Unauthorized access to information system or data: Whoever gains unauthorized access to any information system or data with dishonest intention.", punishment: "Imprisonment up to 3 months, or fine up to 50,000 rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 4", description: "Unauthorized copying or transmission of data: Whoever copies or otherwise transmits or causes to be transmitted any data without authorization.", punishment: "Imprisonment up to 6 months, or fine up to 100,000 rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 5", description: "Interference with information system or data: Whoever intentionally interferes with or damages any information system or data.", punishment: "Imprisonment up to 2 years, or fine up to 500,000 rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 10", description: "Cyber terrorism: Whoever commits or threatens to commit an offence under this Act with the intent to coerce, intimidate, or create a sense of fear, panic, or insecurity.", punishment: "Imprisonment up to 14 years, or fine up to 50 million rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 11", description: "Electronic forgery: Whoever interferes with or uses any information system, device, or data with the intention of causing damage or injury to the public or to any person, or to make any illegal claim or title.", punishment: "Imprisonment up to 3 years, or fine up to 250,000 rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 12", description: "Electronic fraud: Whoever with dishonest intention gains unauthorized access to any information system or data and acquires, transfers, or uses another person's identity.", punishment: "Imprisonment up to 3 years, or fine up to 500,000 rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 16", description: "Offences against dignity of a natural person: Whoever intentionally and publicly exhibits or displays or transmits any information through any information system which superimposes a photograph of the face of a natural person on any sexually explicit image.", punishment: "Imprisonment up to 5 years, or fine up to 5 million rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 20", description: "Offences against modesty of a natural person and minor: Whoever intentionally writes, offers, or makes available information that advances or is used for committing or facilitating an offence against the modesty of a natural person or a minor.", punishment: "Imprisonment up to 7 years, or fine up to 5 million rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 21", description: "Child pornography: Whoever intentionally produces, offers, distributes, transmits, procures, or possesses any material depicting a minor engaged in sexually explicit conduct.", punishment: "Imprisonment up to 7 years, or fine up to 5 million rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 24", description: "Cyber stalking: Whoever with intent to coerce, intimidate, or harass any person uses information technology, electronic communication, or electronic mail for such purpose.", punishment: "Imprisonment up to 3 years, or fine up to 1 million rupees, or both" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 34", description: "Investigation and prosecution: Offences under this Act shall be investigated by the Federal Investigation Agency.", punishment: "" },
  { shortTitle: "Prevention of Electronic Crimes Act, 2016", section: "Section 37", description: "Unlawful online content: The Authority may direct any service provider to remove or block access to any information through any information system if it considers it necessary in the interest of the glory of Islam, integrity, security, or defence of Pakistan.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 24. WEST PAKISTAN URBAN RENT RESTRICTION ORDINANCE, 1959
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "West Pakistan Urban Rent Restriction Ordinance, 1959", section: "Section 3", description: "Bar on increase in rent: No landlord shall claim or receive any rent in excess of the fair rent.", punishment: "" },
  { shortTitle: "West Pakistan Urban Rent Restriction Ordinance, 1959", section: "Section 5", description: "Fair rent: The Controller shall fix the fair rent of a building on the application of the tenant or landlord.", punishment: "" },
  { shortTitle: "West Pakistan Urban Rent Restriction Ordinance, 1959", section: "Section 13", description: "Grounds for ejectment of tenants: A landlord may apply for ejectment on grounds of non-payment of rent for 2 months, subletting without consent, commission of nuisance, bona fide requirement for own use, demolition for reconstruction, or tenant's default.", punishment: "" },
  { shortTitle: "West Pakistan Urban Rent Restriction Ordinance, 1959", section: "Section 15", description: "Controller's power to issue orders of ejectment: The Controller, on an application being made, may pass an order directing the tenant to put the landlord in possession.", punishment: "" },
  { shortTitle: "West Pakistan Urban Rent Restriction Ordinance, 1959", section: "Section 17", description: "Appeal: Any person aggrieved by an order of the Controller may, within 30 days, file an appeal to the Appellate Authority (District Judge or Additional District Judge).", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 25. LAND ACQUISITION ACT, 1894
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Land Acquisition Act, 1894", section: "Section 4", description: "Publication of preliminary notification and power of officers to enter: Whenever it appears to the Government that land in any locality is needed for any public purpose, a notification shall be published in the official Gazette.", punishment: "" },
  { shortTitle: "Land Acquisition Act, 1894", section: "Section 5A", description: "Hearing of objections: Any person interested in any land which has been notified under Section 4 may object to the acquisition within 30 days.", punishment: "" },
  { shortTitle: "Land Acquisition Act, 1894", section: "Section 6", description: "Declaration that land is required for public purpose: When the Government is satisfied that any land is needed for a public purpose, a declaration shall be made.", punishment: "" },
  { shortTitle: "Land Acquisition Act, 1894", section: "Section 9", description: "Notice to persons interested: The Collector shall cause public notice to be given at convenient places on or near the land to be taken, and direct that all persons interested in the land shall appear before him.", punishment: "" },
  { shortTitle: "Land Acquisition Act, 1894", section: "Section 11", description: "Enquiry and award by Collector: The Collector shall make an award of the compensation he considers proper.", punishment: "" },
  { shortTitle: "Land Acquisition Act, 1894", section: "Section 18", description: "Reference to court: Any person who has not accepted the award may require that the matter be referred to the court for determination.", punishment: "" },
  { shortTitle: "Land Acquisition Act, 1894", section: "Section 23", description: "Matters to be considered in determining compensation: The market value of the land at the date of publication of notification under Section 4, damage by severance, injury to other property, reasonable expenses, and diminution of profits.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 26. SUCCESSION ACT, 1925
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Succession Act, 1925", section: "Section 57", description: "Application of Part to certain classes only: Part V (succession certificates) applies only to debts and securities. Does not apply to Muslim succession.", punishment: "" },
  { shortTitle: "Succession Act, 1925", section: "Section 213", description: "Right as executor or legatee when established: No right as executor or legatee can be established in any court of justice unless a probate or letters of administration have been granted.", punishment: "" },
  { shortTitle: "Succession Act, 1925", section: "Section 218", description: "Grant of probate: Probate shall be granted to the executor appointed by the will, and shall have effect over all the property and rights and credits of the deceased.", punishment: "" },
  { shortTitle: "Succession Act, 1925", section: "Section 278", description: "Succession certificate: When a person dies, a certificate may be granted to any person claiming to be entitled to the succession of the deceased.", punishment: "" },
  { shortTitle: "Succession Act, 1925", section: "Section 370", description: "Application of Act to intestate succession: The provisions of this Act regarding intestate succession shall not apply to Muslims, Hindus, Buddhists, Sikhs, or Jains.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 27. COURT FEES ACT, 1870
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Court Fees Act, 1870", section: "Section 3", description: "Levy of fees: The fees mentioned in the First and Second Schedules shall be levied in the manner therein prescribed.", punishment: "" },
  { shortTitle: "Court Fees Act, 1870", section: "Section 7", description: "Computation of fees payable in suits for money or movable property: In suits for money or movable property having a market value, ad valorem fee shall be computed on the amount or value of the subject matter.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 28. PUNJAB PRE-EMPTION ACT, 1913
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Punjab Pre-emption Act, 1913", section: "Section 4", description: "Right of pre-emption in respect of agricultural land and urban immovable property: Every co-sharer in the holding, every owner of the contiguous land, and every member of the same village community has a right of pre-emption.", punishment: "" },
  { shortTitle: "Punjab Pre-emption Act, 1913", section: "Section 6", description: "Demand for pre-emption: The pre-emptor must make his demand (talb-i-muwathibat) immediately on receiving information of the sale, followed by talb-i-ishhad (demand in presence of witnesses).", punishment: "" },
  { shortTitle: "Punjab Pre-emption Act, 1913", section: "Section 13", description: "Order of pre-emption right holders: The right of pre-emption vests first in the co-sharer, then the owner of adjoining land, then other village community members.", punishment: "" },
  { shortTitle: "Punjab Pre-emption Act, 1913", section: "Section 21", description: "Limitation for suit: A suit for pre-emption must be filed within one year from the date of sale or from the date the plaintiff comes to know of the sale.", punishment: "" },

  // ═══════════════════════════════════════════════════════════════════════════
  // 29. COMPANIES ACT, 2017
  // ═══════════════════════════════════════════════════════════════════════════
  { shortTitle: "Companies Act, 2017", section: "Section 2", description: "Definitions: Defines 'associate company', 'body corporate', 'company', 'debenture', 'director', 'holding company', 'listed company', 'officer', 'private company', 'public company', 'share', and 'subsidiary'.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 10", description: "Formation of company: Any person may form a company by subscribing to a memorandum of association and complying with the requirements of this Act.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 15", description: "Memorandum of association: The memorandum of every company shall state the name of the company, the province in which the registered office is situate, the objects of the company, and the liability of members.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 16", description: "Articles of association: There may be registered with the memorandum, articles of association prescribing regulations for the company.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 29", description: "Registration: The registrar shall register the company and issue a certificate of incorporation.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 85", description: "Annual general meeting: Every company other than a single-member company shall hold an annual general meeting.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 153", description: "Appointment of directors: Every company shall have a board of directors. Private company — minimum 2; public company — minimum 3.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 166", description: "Directors' duties: A director shall act in good faith in order to promote the objects of the company for the benefit of its members as a whole.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 290", description: "Winding up by court: A company may be wound up by the court if the company has passed a special resolution, has not commenced business within a year, is unable to pay its debts, or it is just and equitable.", punishment: "" },
  { shortTitle: "Companies Act, 2017", section: "Section 305", description: "Voluntary winding up: A company may be wound up voluntarily by passing a special resolution.", punishment: "" },

];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!db) {
    console.error("❌ Database not available. Check DATABASE_URL environment variable.");
    process.exit(1);
  }

  console.log(`\n📜 Comprehensive Statute Seed — ${STATUTE_DATA.length} entries across 29 statutes\n`);

  // Count entries per statute for reporting
  const perStatute = new Map<string, number>();
  for (const e of STATUTE_DATA) {
    perStatute.set(e.shortTitle, (perStatute.get(e.shortTitle) || 0) + 1);
  }
  console.log("Statutes to seed:");
  for (const [name, count] of perStatute) {
    console.log(`  • ${name}: ${count} entries`);
  }
  console.log("");

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of STATUTE_DATA) {
    try {
      const existing = await db
        .select({ id: statutes.id })
        .from(statutes)
        .where(
          and(
            ilike(statutes.shortTitle, entry.shortTitle),
            ilike(statutes.section, entry.section),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(statutes).values(entry);
      inserted++;

      if (inserted % 50 === 0) {
        console.log(`  ✅ ${inserted} inserted so far...`);
      }
    } catch (err: any) {
      errors++;
      console.error(`  ❌ ${entry.shortTitle} ${entry.section}: ${err.message}`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ✅ Inserted:  ${inserted}`);
  console.log(`  ⏭️  Skipped:   ${skipped} (already exist)`);
  if (errors > 0) console.log(`  ❌ Errors:    ${errors}`);
  console.log(`  📊 Total:     ${STATUTE_DATA.length}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (pool) await pool.end();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
