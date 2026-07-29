// Multi-language demo-mode reminder templates — ported verbatim from
// backend-fastapi-archive/src/app/services/ai_service.py (_EN/_DE/_FR/_JA/_ES/_AR).

import { ReminderType } from "../common/enums";

export interface EmailTemplate {
  subject: string;
  message: string;
}

export interface LangTemplates {
  email: Partial<Record<ReminderType, EmailTemplate>>;
  whatsapp: Partial<Record<ReminderType, string>>;
  sms?: Partial<Record<ReminderType, string>>;
}

export const COUNTRY_LANG: Record<string, string> = {
  germany: "de",
  austria: "de",
  switzerland: "de",
  france: "fr",
  belgium: "fr",
  japan: "ja",
  mexico: "es",
  spain: "es",
  colombia: "es",
  argentina: "es",
  chile: "es",
  "united arab emirates": "ar",
  uae: "ar",
  "saudi arabia": "ar",
  qatar: "ar",
  kuwait: "ar",
  bahrain: "ar",
  egypt: "ar",
  brazil: "pt",
  portugal: "pt",
};

const EN: LangTemplates = {
  email: {
    [ReminderType.FIRST_NOTICE]: {
      subject: "Friendly Reminder: Invoice {invoice_number} Payment Due",
      message:
        "Dear {name},\n\nI hope this message finds you well. I'm writing to kindly remind you that Invoice {invoice_number} for {currency} {amount_due:.2f} was due on {due_date}.\n\nWe understand that oversights happen, and we'd appreciate your prompt attention to settle this balance at your earliest convenience.\n\nIf you've already processed this payment, please disregard this notice.\n\nBest regards,\nAccounts Receivable Team",
    },
    [ReminderType.SECOND_NOTICE]: {
      subject: "Second Notice: Invoice {invoice_number} — {days_overdue} Days Overdue",
      message:
        "Dear {name},\n\nThis is a follow-up regarding Invoice {invoice_number} for {currency} {amount_due:.2f}, which remains outstanding {days_overdue} days past its due date of {due_date}.\n\nWe kindly request that you arrange payment within the next 5 business days to avoid any service disruptions.\n\nIf you are experiencing financial difficulties, please contact us immediately to discuss a structured payment plan.\n\nKind regards,\nAccounts Receivable Team",
    },
    [ReminderType.FINAL_NOTICE]: {
      subject: "FINAL NOTICE: Invoice {invoice_number} — Immediate Action Required",
      message:
        "Dear {name},\n\nThis is our final notice regarding Invoice {invoice_number} for {currency} {amount_due:.2f}, which is now {days_overdue} days overdue.\n\nIf payment is not received within 48 hours, we will be forced to escalate this matter to our collections department, which may affect your credit standing and our business relationship.\n\nTo avoid further action, please remit payment immediately or contact us to arrange a payment plan.\n\nRegards,\nFinance Department",
    },
    [ReminderType.PAYMENT_PLAN_OFFER]: {
      subject: "Payment Plan Available — Invoice {invoice_number}",
      message:
        "Dear {name},\n\nWe understand that circumstances can sometimes make timely payment challenging. To help resolve Invoice {invoice_number} ({currency} {amount_due:.2f}), we'd like to offer you a flexible payment arrangement.\n\nWe can split the outstanding balance into manageable installments tailored to your cash flow. Please reply within 3 business days to set up a plan.\n\nWarm regards,\nAccounts Receivable Team",
    },
    [ReminderType.ESCALATION]: {
      subject: "ESCALATED: Invoice {invoice_number} — Referred to Collections",
      message:
        "Dear {name},\n\nInvoice {invoice_number} ({currency} {amount_due:.2f}) has been formally escalated to our collections department after {days_overdue} days without payment.\n\nPlease contact us within 24 hours to resolve this matter and avoid further legal action.\n\nRegards,\nFinance Department",
    },
  },
  whatsapp: {
    [ReminderType.FIRST_NOTICE]:
      "Hi {name}, gentle reminder that Invoice {invoice_number} ({currency} {amount_due:.2f}) was due {due_date}. Please arrange payment when convenient. Thank you 🙏",
    [ReminderType.SECOND_NOTICE]:
      "Hi {name}, following up on Invoice {invoice_number} ({currency} {amount_due:.2f}) — now {days_overdue} days overdue. Please settle at your earliest. Reply if you have any queries.",
    [ReminderType.FINAL_NOTICE]:
      "URGENT {name}: Invoice {invoice_number} ({currency} {amount_due:.2f}) is critically overdue ({days_overdue} days). Immediate payment required to avoid escalation. Contact us now.",
    [ReminderType.PAYMENT_PLAN_OFFER]:
      "Hi {name}, we'd like to help you settle Invoice {invoice_number} ({currency} {amount_due:.2f}) through a flexible payment plan. Reply to discuss options. 📋",
    [ReminderType.ESCALATION]:
      "{name}, Invoice {invoice_number} ({currency} {amount_due:.2f}) has been escalated to our collections team. Please contact us within 24hrs to resolve this matter.",
  },
  sms: {
    [ReminderType.FIRST_NOTICE]: "REMINDER: Invoice {invoice_number} ({currency} {amount_due:.2f}) due {due_date}. Please pay to avoid late fees.",
    [ReminderType.SECOND_NOTICE]: "NOTICE: Invoice {invoice_number} ({currency} {amount_due:.2f}) is {days_overdue} days overdue. Pay now to avoid escalation.",
    [ReminderType.FINAL_NOTICE]: "FINAL NOTICE: Invoice {invoice_number} ({currency} {amount_due:.2f}) {days_overdue}d overdue. Pay in 48hrs or account escalates to collections.",
    [ReminderType.PAYMENT_PLAN_OFFER]: "Invoice {invoice_number} ({currency} {amount_due:.2f}) overdue. We offer payment plans. Reply to discuss.",
    [ReminderType.ESCALATION]: "ESCALATED: Invoice {invoice_number} now with collections. Call immediately to avoid credit impact.",
  },
};

const DE: LangTemplates = {
  email: {
    [ReminderType.FIRST_NOTICE]: {
      subject: "Zahlungserinnerung: Rechnung {invoice_number} – Zahlung ausstehend",
      message:
        "Sehr geehrte/r {name},\n\nwir hoffen, diese Nachricht erreicht Sie wohlbehalten. Wir möchten Sie freundlich daran erinnern, dass Rechnung {invoice_number} über {currency} {amount_due:.2f} am {due_date} fällig war.\n\nWir bitten Sie, die offene Zahlung baldmöglichst zu begleichen. Sollten Sie die Zahlung bereits veranlasst haben, bitten wir Sie, diese Erinnerung zu ignorieren.\n\nBei Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen,\nBuchhaltungsabteilung",
    },
    [ReminderType.SECOND_NOTICE]: {
      subject: "Zweite Mahnung: Rechnung {invoice_number} – {days_overdue} Tage überfällig",
      message:
        "Sehr geehrte/r {name},\n\nwir möchten Sie erneut auf die ausstehende Zahlung für Rechnung {invoice_number} über {currency} {amount_due:.2f} hinweisen, die seit {days_overdue} Tagen überfällig ist.\n\nWir bitten Sie dringend, den ausstehenden Betrag innerhalb von 5 Werktagen zu überweisen. Andernfalls sehen wir uns gezwungen, weitere Maßnahmen einzuleiten.\n\nFalls Sie Zahlungsschwierigkeiten haben, kontaktieren Sie uns bitte umgehend.\n\nMit freundlichen Grüßen,\nBuchhaltungsabteilung",
    },
    [ReminderType.FINAL_NOTICE]: {
      subject: "LETZTE MAHNUNG: Rechnung {invoice_number} – Sofortmaßnahme erforderlich",
      message:
        "Sehr geehrte/r {name},\n\ndies ist unsere letzte Zahlungsaufforderung für Rechnung {invoice_number} über {currency} {amount_due:.2f}, die seit {days_overdue} Tagen überfällig ist.\n\nSollte die Zahlung nicht innerhalb von 48 Stunden eingehen, werden wir die Angelegenheit an unser Inkassobüro übergeben, was sich auf Ihre Bonität auswirken kann.\n\nBitte überweisen Sie den Betrag sofort oder kontaktieren Sie uns zur Vereinbarung eines Zahlungsplans.\n\nMit freundlichen Grüßen,\nFinanzabteilung",
    },
    [ReminderType.PAYMENT_PLAN_OFFER]: {
      subject: "Ratenzahlung möglich – Rechnung {invoice_number}",
      message:
        "Sehr geehrte/r {name},\n\nwir verstehen, dass es manchmal zu Zahlungsschwierigkeiten kommen kann. Für die offene Rechnung {invoice_number} ({currency} {amount_due:.2f}) bieten wir Ihnen gerne eine flexible Ratenzahlungsvereinbarung an.\n\nBitte antworten Sie auf diese E-Mail oder rufen Sie uns innerhalb von 3 Werktagen an.\n\nMit freundlichen Grüßen,\nBuchhaltungsabteilung",
    },
    [ReminderType.ESCALATION]: {
      subject: "ESKALATION: Rechnung {invoice_number} – Inkassobüro eingeschalten",
      message:
        "Sehr geehrte/r {name},\n\nRechnung {invoice_number} ({currency} {amount_due:.2f}) wurde nach {days_overdue} Tagen ohne Zahlung an unser Inkassobüro übergeben.\n\nBitte kontaktieren Sie uns innerhalb von 24 Stunden, um diese Angelegenheit zu lösen.\n\nMit freundlichen Grüßen,\nFinanzabteilung",
    },
  },
  whatsapp: {
    [ReminderType.FIRST_NOTICE]:
      "Hallo {name}, freundliche Erinnerung: Rechnung {invoice_number} ({currency} {amount_due:.2f}) war am {due_date} fällig. Bitte überweisen Sie baldmöglichst. Vielen Dank 🙏",
    [ReminderType.SECOND_NOTICE]:
      "Hallo {name}, Nachfrage zu Rechnung {invoice_number} ({currency} {amount_due:.2f}) – seit {days_overdue} Tagen überfällig. Bitte begleichen Sie den Betrag. Bei Fragen stehen wir gerne zur Verfügung.",
    [ReminderType.FINAL_NOTICE]:
      "DRINGEND {name}: Rechnung {invoice_number} ({currency} {amount_due:.2f}) ist seit {days_overdue} Tagen überfällig. Sofortige Zahlung erforderlich, um Inkasso zu vermeiden.",
    [ReminderType.PAYMENT_PLAN_OFFER]:
      "Hallo {name}, wir bieten Ihnen eine Ratenzahlung für Rechnung {invoice_number} ({currency} {amount_due:.2f}) an. Antworten Sie für weitere Details. 📋",
    [ReminderType.ESCALATION]:
      "{name}: Rechnung {invoice_number} wurde an das Inkassobüro übergeben. Bitte kontaktieren Sie uns innerhalb von 24 Stunden.",
  },
};

const FR: LangTemplates = {
  email: {
    [ReminderType.FIRST_NOTICE]: {
      subject: "Rappel de paiement : Facture {invoice_number} en attente",
      message:
        "Cher(e) {name},\n\nNous espérons que vous vous portez bien. Nous vous contactons pour vous rappeler que la facture {invoice_number} d'un montant de {currency} {amount_due:.2f} était due le {due_date}.\n\nNous vous prions de bien vouloir régler ce solde dans les meilleurs délais. Si vous avez déjà effectué ce paiement, veuillez ignorer ce message.\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,\nService Comptabilité",
    },
    [ReminderType.SECOND_NOTICE]: {
      subject: "Deuxième relance : Facture {invoice_number} – {days_overdue} jours de retard",
      message:
        "Cher(e) {name},\n\nNous vous relançons concernant la facture {invoice_number} d'un montant de {currency} {amount_due:.2f}, qui est en retard de {days_overdue} jours.\n\nNous vous prions de régler le solde dans les 5 jours ouvrables afin d'éviter toute perturbation de service.\n\nSi vous rencontrez des difficultés financières, contactez-nous immédiatement pour discuter d'un échéancier.\n\nCordialement,\nService Comptabilité",
    },
    [ReminderType.FINAL_NOTICE]: {
      subject: "DERNIER AVIS : Facture {invoice_number} – Action immédiate requise",
      message:
        "Cher(e) {name},\n\nCeci est notre dernière mise en demeure concernant la facture {invoice_number} d'un montant de {currency} {amount_due:.2f}, en retard de {days_overdue} jours.\n\nSi le paiement n'est pas reçu dans les 48 heures, nous serons contraints de transmettre ce dossier à notre service de recouvrement.\n\nCordialement,\nDépartement Financier",
    },
    [ReminderType.PAYMENT_PLAN_OFFER]: {
      subject: "Proposition d'échéancier – Facture {invoice_number}",
      message:
        "Cher(e) {name},\n\nNous comprenons que les difficultés de trésorerie peuvent survenir. Pour vous aider à régler la facture {invoice_number} ({currency} {amount_due:.2f}), nous vous proposons un échelonnement de paiement flexible.\n\nVeuillez nous répondre dans les 3 jours ouvrables.\n\nCordialement,\nService Comptabilité",
    },
    [ReminderType.ESCALATION]: {
      subject: "CONTENTIEUX : Facture {invoice_number} transmise au recouvrement",
      message:
        "Cher(e) {name},\n\nLa facture {invoice_number} ({currency} {amount_due:.2f}) a été transmise à notre service de recouvrement après {days_overdue} jours sans paiement.\n\nVeuillez nous contacter dans les 24 heures.\n\nCordialement,\nDépartement Financier",
    },
  },
  whatsapp: {
    [ReminderType.FIRST_NOTICE]:
      "Bonjour {name}, rappel amical : la facture {invoice_number} ({currency} {amount_due:.2f}) était due le {due_date}. Merci de procéder au règlement dès que possible 🙏",
    [ReminderType.SECOND_NOTICE]:
      "Bonjour {name}, relance pour la facture {invoice_number} ({currency} {amount_due:.2f}) — {days_overdue} jours de retard. Veuillez régler au plus vite.",
    [ReminderType.FINAL_NOTICE]:
      "URGENT {name} : Facture {invoice_number} ({currency} {amount_due:.2f}) en retard de {days_overdue} jours. Paiement immédiat requis pour éviter le contentieux.",
    [ReminderType.PAYMENT_PLAN_OFFER]:
      "Bonjour {name}, nous vous proposons un échéancier pour la facture {invoice_number} ({currency} {amount_due:.2f}). Répondez pour en discuter. 📋",
    [ReminderType.ESCALATION]: "{name} : La facture {invoice_number} a été transmise au recouvrement. Contactez-nous sous 24h.",
  },
};

const JA: LangTemplates = {
  email: {
    [ReminderType.FIRST_NOTICE]: {
      subject: "お支払いのご案内：請求書 {invoice_number}",
      message:
        "{name}様、\n\nいつもお世話になっております。\n\n請求書番号 {invoice_number}（{currency} {amount_due:.2f}）のお支払期限が{due_date}となっておりましたが、まだご入金の確認が取れておりません。\n\nご多忙のところ恐れ入りますが、お早めにご対応いただけますようお願い申し上げます。すでにご入金済みの場合は、本メールをご無視ください。\n\n何卒よろしくお願いいたします。\n経理部",
    },
    [ReminderType.SECOND_NOTICE]: {
      subject: "再度のお支払いご催促：請求書 {invoice_number}（{days_overdue}日超過）",
      message:
        "{name}様、\n\nいつもお世話になっております。\n\n先日ご案内いたしました請求書番号 {invoice_number}（{currency} {amount_due:.2f}）につきまして、現在{days_overdue}日を超えて未払いの状態となっております。\n\n誠に恐れ入りますが、5営業日以内にお支払いいただけますようお願い申し上げます。お支払いが困難な場合は、分割払いのご相談も承っております。\n\n何卒よろしくお願いいたします。\n経理部",
    },
    [ReminderType.FINAL_NOTICE]: {
      subject: "最終通告：請求書 {invoice_number} – 至急ご対応ください",
      message:
        "{name}様、\n\nこれが最終通告となります。請求書番号 {invoice_number}（{currency} {amount_due:.2f}）は現在{days_overdue}日超過しております。\n\n48時間以内にご入金がない場合、回収部門に引き継がせていただく場合がございます。\n\n至急ご対応をお願いいたします。\n財務部",
    },
    [ReminderType.PAYMENT_PLAN_OFFER]: {
      subject: "分割払いのご提案：請求書 {invoice_number}",
      message:
        "{name}様、\n\nご状況をお察しし、請求書番号 {invoice_number}（{currency} {amount_due:.2f}）について分割払いをご提案させていただきます。\n\n3営業日以内にご返信いただければ、柔軟なお支払い計画を調整いたします。\n\n何卒よろしくお願いいたします。\n経理部",
    },
    [ReminderType.ESCALATION]: {
      subject: "回収部門移管のお知らせ：請求書 {invoice_number}",
      message:
        "{name}様、\n\n請求書番号 {invoice_number}（{currency} {amount_due:.2f}）は{days_overdue}日間未払いのため、回収部門に移管いたしました。\n\n24時間以内にご連絡ください。\n\n財務部",
    },
  },
  whatsapp: {
    [ReminderType.FIRST_NOTICE]: "{name}様、請求書 {invoice_number}（{currency} {amount_due:.2f}）のお支払期限が{due_date}でした。ご対応をお願いいたします 🙏",
    [ReminderType.SECOND_NOTICE]: "{name}様、請求書 {invoice_number}（{currency} {amount_due:.2f}）が{days_overdue}日超過しております。至急お支払いをお願いいたします。",
    [ReminderType.FINAL_NOTICE]: "【至急】{name}様、請求書 {invoice_number}（{currency} {amount_due:.2f}）が{days_overdue}日超過。回収部門移管前にご対応ください。",
    [ReminderType.PAYMENT_PLAN_OFFER]: "{name}様、請求書 {invoice_number}（{currency} {amount_due:.2f}）の分割払いをご提案します。ご返信ください 📋",
    [ReminderType.ESCALATION]: "{name}様、請求書 {invoice_number} は回収部門に移管されました。24時間以内にご連絡ください。",
  },
};

const ES: LangTemplates = {
  email: {
    [ReminderType.FIRST_NOTICE]: {
      subject: "Recordatorio de pago: Factura {invoice_number} pendiente",
      message:
        "Estimado/a {name},\n\nEsperamos que se encuentre bien. Le escribimos para recordarle que la factura {invoice_number} por un importe de {currency} {amount_due:.2f} venció el {due_date}.\n\nLe rogamos que proceda al pago a la mayor brevedad posible. Si ya ha realizado el pago, por favor ignore este mensaje.\n\nQuedamos a su disposición para cualquier consulta.\n\nAtentamente,\nDepartamento de Contabilidad",
    },
    [ReminderType.SECOND_NOTICE]: {
      subject: "Segundo aviso: Factura {invoice_number} – {days_overdue} días de mora",
      message:
        "Estimado/a {name},\n\nLe contactamos nuevamente en relación con la factura {invoice_number} por {currency} {amount_due:.2f}, que lleva {days_overdue} días de retraso.\n\nLe solicitamos que realice el pago en los próximos 5 días hábiles para evitar cargos adicionales.\n\nSi tiene dificultades financieras, no dude en contactarnos para acordar un plan de pagos.\n\nAtentamente,\nDepartamento de Contabilidad",
    },
    [ReminderType.FINAL_NOTICE]: {
      subject: "AVISO FINAL: Factura {invoice_number} – Acción inmediata requerida",
      message:
        "Estimado/a {name},\n\nEste es nuestro aviso final respecto a la factura {invoice_number} por {currency} {amount_due:.2f}, que lleva {days_overdue} días de mora.\n\nSi no recibimos el pago en las próximas 48 horas, nos veremos obligados a trasladar este asunto a nuestra agencia de cobros.\n\nAtentamente,\nDepartamento Financiero",
    },
    [ReminderType.PAYMENT_PLAN_OFFER]: {
      subject: "Propuesta de plan de pagos – Factura {invoice_number}",
      message:
        "Estimado/a {name},\n\nEntendemos que pueden surgir dificultades financieras. Para ayudarle a resolver la factura {invoice_number} ({currency} {amount_due:.2f}), le ofrecemos un plan de pagos flexible.\n\nResponda en los próximos 3 días hábiles para coordinar los detalles.\n\nAtentamente,\nDepartamento de Contabilidad",
    },
    [ReminderType.ESCALATION]: {
      subject: "ESCALADO: Factura {invoice_number} enviada a cobros",
      message:
        "Estimado/a {name},\n\nLa factura {invoice_number} ({currency} {amount_due:.2f}) ha sido enviada a nuestra agencia de cobros tras {days_overdue} días sin pago.\n\nContáctenos dentro de las próximas 24 horas.\n\nAtentamente,\nDepartamento Financiero",
    },
  },
  whatsapp: {
    [ReminderType.FIRST_NOTICE]:
      "Hola {name}, recordatorio: la factura {invoice_number} ({currency} {amount_due:.2f}) venció el {due_date}. Por favor realice el pago cuando pueda. Gracias 🙏",
    [ReminderType.SECOND_NOTICE]:
      "Hola {name}, seguimiento de la factura {invoice_number} ({currency} {amount_due:.2f}) — {days_overdue} días de mora. Por favor regularice el pago.",
    [ReminderType.FINAL_NOTICE]:
      "URGENTE {name}: Factura {invoice_number} ({currency} {amount_due:.2f}) con {days_overdue} días de mora. Pago inmediato requerido para evitar cobros.",
    [ReminderType.PAYMENT_PLAN_OFFER]:
      "Hola {name}, le ofrecemos un plan de pagos para la factura {invoice_number} ({currency} {amount_due:.2f}). Responda para coordinar. 📋",
    [ReminderType.ESCALATION]: "{name}: La factura {invoice_number} fue enviada a cobros. Contáctenos en 24h.",
  },
};

const AR: LangTemplates = {
  email: {
    [ReminderType.FIRST_NOTICE]: {
      subject: "تذكير بالدفع: الفاتورة {invoice_number}",
      message:
        "عزيزي/عزيزتي {name}،\n\nنأمل أن تكون بخير. نتواصل معك لتذكيرك بأن الفاتورة رقم {invoice_number} بمبلغ {currency} {amount_due:.2f} كان موعد استحقاقها {due_date}.\n\nنرجو منك سداد المبلغ المستحق في أقرب وقت ممكن. إذا كنت قد أتممت الدفع بالفعل، يرجى تجاهل هذه الرسالة.\n\nلا تتردد في التواصل معنا لأي استفسار.\n\nمع التحية،\nقسم المحاسبة",
    },
    [ReminderType.SECOND_NOTICE]: {
      subject: "إشعار ثانٍ: الفاتورة {invoice_number} – متأخرة {days_overdue} يوماً",
      message:
        "عزيزي/عزيزتي {name}،\n\nنتواصل معك مجدداً بخصوص الفاتورة رقم {invoice_number} بمبلغ {currency} {amount_due:.2f}، والتي تأخر سدادها {days_overdue} يوماً.\n\nنطلب منك سداد هذا المبلغ خلال 5 أيام عمل لتجنب أي إجراءات إضافية.\n\nإذا كنت تواجه صعوبات مالية، يرجى التواصل معنا فوراً لمناقشة خيارات السداد.\n\nمع التحية،\nقسم المالية",
    },
    [ReminderType.FINAL_NOTICE]: {
      subject: "إشعار نهائي: الفاتورة {invoice_number} – يُرجى الرد الفوري",
      message:
        "عزيزي/عزيزتي {name}،\n\nهذا هو إشعارنا الأخير بخصوص الفاتورة رقم {invoice_number} بمبلغ {currency} {amount_due:.2f}، المتأخرة {days_overdue} يوماً.\n\nفي حال عدم استلام الدفعة خلال 48 ساعة، سيتم إحالة هذا الملف إلى قسم التحصيل مما قد يؤثر على سمعتك الائتمانية.\n\nمع التحية،\nالإدارة المالية",
    },
    [ReminderType.PAYMENT_PLAN_OFFER]: {
      subject: "عرض خطة دفع مرنة – الفاتورة {invoice_number}",
      message:
        "عزيزي/عزيزتي {name}،\n\nندرك أن الظروف المالية قد تكون صعبة أحياناً. لمساعدتك في تسوية الفاتورة رقم {invoice_number} ({currency} {amount_due:.2f})، نقترح عليك خطة دفع مرنة بالأقساط.\n\nيرجى الرد خلال 3 أيام عمل للتنسيق.\n\nمع التحية،\nقسم المحاسبة",
    },
    [ReminderType.ESCALATION]: {
      subject: "تصعيد: الفاتورة {invoice_number} أُحيلت لقسم التحصيل",
      message:
        "عزيزي/عزيزتي {name}،\n\nتم إحالة الفاتورة رقم {invoice_number} ({currency} {amount_due:.2f}) إلى قسم التحصيل بعد تأخر {days_overdue} يوماً دون سداد.\n\nيرجى التواصل معنا خلال 24 ساعة لتسوية هذا الأمر.\n\nمع التحية،\nالإدارة المالية",
    },
  },
  whatsapp: {
    [ReminderType.FIRST_NOTICE]:
      "مرحباً {name}، تذكير ودّي: الفاتورة {invoice_number} ({currency} {amount_due:.2f}) كان موعد سدادها {due_date}. يرجى الدفع في أقرب وقت ممكن 🙏",
    [ReminderType.SECOND_NOTICE]: "مرحباً {name}، متابعة للفاتورة {invoice_number} ({currency} {amount_due:.2f}) – تأخرت {days_overdue} يوماً. يرجى السداد العاجل.",
    [ReminderType.FINAL_NOTICE]: "عاجل {name}: الفاتورة {invoice_number} ({currency} {amount_due:.2f}) متأخرة {days_overdue} يوماً. الدفع الفوري مطلوب لتجنب التصعيد.",
    [ReminderType.PAYMENT_PLAN_OFFER]: "مرحباً {name}، نقترح خطة دفع بالأقساط للفاتورة {invoice_number} ({currency} {amount_due:.2f}). ردّ للتنسيق 📋",
    [ReminderType.ESCALATION]: "{name}: تمت إحالة الفاتورة {invoice_number} لقسم التحصيل. تواصل معنا خلال 24 ساعة.",
  },
};

export const LANG_MAP: Record<string, LangTemplates> = { en: EN, de: DE, fr: FR, ja: JA, es: ES, ar: AR };

export function getTemplates(lang: string): LangTemplates {
  return LANG_MAP[lang] ?? EN;
}

export function detectLanguage(country: string): string {
  return COUNTRY_LANG[country.trim().toLowerCase()] ?? "en";
}
