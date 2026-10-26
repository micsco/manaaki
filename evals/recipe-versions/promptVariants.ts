export const PROMPT_VARIANTS = {
  liquid: `
Liquids: decide where every liquid goes and how much is left when the dish is served.
- Slow cooker: almost nothing evaporates under the lid, and meat and vegetables release juice. Cut added stock or water by about a third, unless pasta, rice, grains or pulses have to absorb it. Boil wine or other alcohol hard on Sear/Sauté until reduced by about three quarters before the long cook, so it doesn't taste raw. Say how the sauce gets thick: flour stirred in at the start, or a cornflour slurry on HI for the last 10 to 15 minutes.
- Pasta, rice and grains need enough liquid to cook: about 250 ml per 100 g of orzo or small pasta, and about twice the volume of liquid to rice. Say to keep them covered by liquid and give a tenderness check with what to add if the pot looks dry.
- Air fryer: sauces, glazes and anything runny go in an oven-safe dish or tin that fits inside the drawer, never loose in the drawer. A sauce in a dish barely reduces, so give a visual cue such as "bubbling and coating the back of a spoon" and a few extra minutes if it is still thin.
- Food meant to crisp never sits in liquid. Pour juices off into a jug and stir them back into the sauce at the end, so their flavour isn't lost.`,
  load: `
Capacity: before writing the steps, work out what goes where and check it fits.
- Air fryer: each drawer holds roughly 4 chicken thighs, 2 to 3 fish fillets, or 500 to 600 g of chips or chunky vegetables in a single layer on the crisper plate. Add up what each zone holds. If it won't fit in a single layer across both drawers, either cook in two batches (saying how to keep the first batch warm) or put the item that tolerates crowding, such as diced vegetables to be shaken, in the fuller drawer. The crisper plate sits on short feet and can't be raised, so nothing goes underneath it except in Dehydrate.
- Slow cooker: Slow Cook and Braise work best with the pot between half and two-thirds full. For a small quantity, use the shorter end of the time range; for a big batch, check the pot isn't overfilled.
- Oven: name a tin or dish size that holds the food in one layer.
- Record the plan in assumptions: what goes in each zone or tin, and roughly how much.`,
  carry: `
Carry everything over: list for yourself every cue, tip, baste, turn, resting time, garnish and serving suggestion in the original, and make sure each one appears in your method or notes. Leave one out only when the new appliance makes it pointless, and then say why in assumptions. Don't remove a stage that builds flavour (browning, reducing, basting with pan juices) unless you replace it.
Hands-on times must be realistic for a home cook: softening onions takes 8 to 10 minutes, browning meat takes about 4 to 5 minutes per batch of roughly 500 g (so brown larger amounts in batches), and reducing a sauce by half takes 5 to 10 minutes. Include these in prep or cook time.`,
} as const

export type PromptVariant = keyof typeof PROMPT_VARIANTS

export function isPromptVariant(name: string): name is PromptVariant {
  return Object.hasOwn(PROMPT_VARIANTS, name)
}

export function withVariants(system: string, variants: PromptVariant[]): string {
  return [system, ...variants.map(variant => PROMPT_VARIANTS[variant].trim())].join("\n\n")
}
