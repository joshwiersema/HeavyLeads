// ---------------------------------------------------------------------------
// Wizard state reducer -- useReducer state machine for onboarding wizard
// ---------------------------------------------------------------------------

import { WIZARD_STEPS, type WizardState, type WizardAction } from "./types";

export const initialWizardState: Readonly<WizardState> = Object.freeze({
  currentStep: 0,
  industry: null,
  companyName: "",
  companySize: "",
  yearsInBusiness: null,
  street: "",
  city: "",
  state: "",
  zip: "",
  serviceRadiusMiles: 50,
  serviceAreaLat: null,
  serviceAreaLng: null,
  specializations: [],
  serviceTypes: [],
  certifications: [],
  minProjectValue: null,
  maxProjectValue: null,
  preferredLeadTypes: [],
  alertFrequency: "daily",
});

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return {
        ...state,
        currentStep: Math.max(0, Math.min(action.step, WIZARD_STEPS.length - 1)),
      };

    case "NEXT_STEP":
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, WIZARD_STEPS.length - 1),
      };

    case "PREV_STEP":
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 0),
      };

    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
      };

    case "SET_FIELDS":
      return {
        ...state,
        ...action.fields,
      };

    case "RESET":
      return { ...initialWizardState };

    case "HYDRATE":
      return { ...action.state };

    default:
      return state;
  }
}
