import {
  DEFAULT_UNIT_PREFERENCE,
  isUnitPreference,
  type UnitPreference,
} from "../utils/unitConversion"
import { useCookingStorage } from "./useCookingStorage"

export function useUnitPreference() {
  const [stored, setPreference] = useCookingStorage<UnitPreference>(
    "unit-system",
    DEFAULT_UNIT_PREFERENCE
  )
  const preference = isUnitPreference(stored) ? stored : DEFAULT_UNIT_PREFERENCE
  return [preference, setPreference] as const
}
