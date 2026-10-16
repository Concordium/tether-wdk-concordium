/** Validate explicit identity coordinates before deriving keys or contacting services. */
export function validateIdentityCoordinates(providerIndex, identityIndex) {
  for (const [name, value] of Object.entries({ providerIndex, identityIndex })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} is required and must be a non-negative safe integer.`);
    }
  }
}
