/**
 * All interface text lives here so Filipino can be added later (SPEC Section 11).
 */
export const copy = {
  brand: {
    name: "Daloyra",
    tagline: "Simple accounting for small business owners.",
  },
  landing: {
    headline: "Know where your money flows.",
    subhead:
      "Record sales, expenses and payments in seconds. See your profit, cash, and who owes you — at a glance.",
    login: "Log in",
    startTrial: "Start free trial",
    trialNote: "14-day free trial. No card needed.",
  },
  common: {
    back: "Back",
    next: "Next",
    optional: "Optional",
    saving: "Saving…",
    unexpectedError: "Something went wrong. Please try again.",
    rateLimited: "Too many attempts. Please wait a few minutes and try again.",
  },
  fields: {
    fullName: "Your name",
    email: "Email",
    password: "Password",
    newPassword: "New password",
    confirmPassword: "Type the new password again",
    passwordHint: "At least 8 characters.",
  },
  validation: {
    nameRequired: "Enter your name.",
    nameTooLong: "Use 120 characters or fewer.",
    emailInvalid: "Enter a valid email address, like juan@example.com.",
    passwordTooShort: "Use at least 8 characters.",
    passwordTooLong: "Use 72 characters or fewer.",
    passwordRequired: "Enter your password.",
    passwordsDontMatch: "The two passwords do not match. Type them again.",
    businessNameRequired: "Enter your business name.",
    tooLong: (max: number) => `Use ${max} characters or fewer.`,
    amountInvalid: "Enter an amount like 1500 or 1500.50 (0 or more).",
    logoType: "Choose a PNG, JPG or WebP image.",
    logoSize: "Choose an image smaller than 2 MB.",
  },
  auth: {
    login: {
      title: "Log in",
      subtitle: "Welcome back.",
      submit: "Log in",
      submitting: "Logging in…",
      forgot: "Forgot password?",
      noAccount: "New to Daloyra?",
      signupLink: "Start free trial",
      invalidCredentials: "Email or password is incorrect.",
      emailNotConfirmed:
        "Please confirm your email first. Open the link we sent you, or send a new one below.",
    },
    signup: {
      title: "Start your free trial",
      subtitle: "14 days free. No card needed.",
      submit: "Create account",
      submitting: "Creating account…",
      haveAccount: "Already have an account?",
      loginLink: "Log in",
      weakPassword: "Choose a stronger password. Avoid common words and add numbers or symbols.",
      terms: "By creating an account you agree to keep your login private.",
    },
    checkEmail: {
      title: "Check your email",
      body: (email: string) =>
        `We sent a link to ${email}. Open it on this phone or computer to confirm your account.`,
      spam: "Can't find it? Check your Spam or Promotions folder.",
      resend: "Send the link again",
      resending: "Sending…",
      resent: "We sent a new link. It can take a minute to arrive.",
      backToLogin: "Back to log in",
    },
    forgot: {
      title: "Reset your password",
      subtitle: "Enter your email and we'll send you a link to choose a new password.",
      submit: "Send reset link",
      submitting: "Sending…",
      sent: "If an account uses that email, a reset link is on its way. Open it on this device.",
      backToLogin: "Back to log in",
    },
    reset: {
      title: "Choose a new password",
      subtitle: "You'll stay logged in after saving.",
      submit: "Save new password",
      submitting: "Saving…",
      samePassword: "Choose a password different from your old one.",
      noSession: "This reset link has expired or was already used. Request a new one.",
      requestNew: "Request a new link",
    },
    confirm: {
      linkInvalid: "That link has expired or was already used. Log in, or request a new link.",
      emailConfirmed: "Log in to continue. If you just confirmed your email, you are all set.",
    },
    logout: "Log out",
  },
  onboarding: {
    title: "Set up your business",
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    steps: {
      basics: {
        title: "About your business",
        name: "Business name",
        namePlaceholder: "e.g. Aling Nena's Store",
        ownerName: "Owner name",
        type: "Type of business",
        typePlaceholder: "Choose one",
      },
      contact: {
        title: "Contact details",
        subtitle: "All optional. These appear on your reports.",
        address: "Address",
        contactNumber: "Contact number",
        email: "Business email",
        logo: "Logo",
        logoHint: "PNG, JPG or WebP, up to 2 MB.",
        chooseLogo: "Choose image",
        changeLogo: "Change image",
        removeLogo: "Remove",
      },
      money: {
        title: "Money",
        currency: "Currency",
        startingCash: "Starting cash",
        startingCashHelp:
          "How much cash does your business have right now? You can change this later.",
        submit: "Finish setup",
        submitting: "Setting up…",
      },
    },
    businessTypes: {
      retail: "Store or retail (sari-sari, shop)",
      food: "Food and drinks",
      online: "Online seller",
      services: "Services",
      other: "Other",
    },
    errors: {
      alreadyExists: "This account already has a business.",
      emailNotConfirmed: "Please confirm your email before setting up your business.",
      invalid: "Some details are not valid. Check each step and try again.",
      logoFailed:
        "Your business is ready, but the logo could not be saved. You can add it later in Settings.",
    },
  },
  app: {
    suspended: {
      title: "This business is paused",
      body: "Your account is currently suspended, so you can't record anything. Please contact Daloyra support to restore access.",
    },
    dashboard: {
      welcome: (name: string) => `Welcome to ${name}`,
      ready:
        "Your business is set up. Recording sales, expenses and payments arrives in the next updates.",
    },
  },
} as const;
