# Recipe URL Scheme

## Structure

```
/recipes/{id}/{slug}
```

| Segment | Role | Example |
|---------|------|---------|
| `id` | Canonical lookup key — a base64url encoding of the recipe's UUID | `PyobTI6dTyqxw31uX0o7LA` |
| `slug` | Decorative SEO suffix — ignored during routing | `sticky-beef-with-a-smashed-cucumber-salad` |

**Full example:**
```
/recipes/PyobTI6dTyqxw31uX0o7LA/sticky-beef-with-a-smashed-cucumber-salad
```

---

## Building a URL from the API

The Mealie API returns a recipe object with two relevant fields:

```json
{
  "id": "3f2a1b4c-8e9d-4f2a-b1c3-7d6e5f4a3b2c",
  "slug": "sticky-beef-with-a-smashed-cucumber-salad"
}
```

To construct the URL:

1. **Encode the `id`** — convert the UUID's 16 raw bytes to base64url (see below)
2. **Use `slug` as-is** for the second segment

```
/recipes/{encode(id)}/{slug}
```

---

## ID Encoding: UUID → base64url

The `id` field is a standard UUID (RFC 4122). To encode it:

1. Strip the hyphens to get 32 hex characters
2. Parse as 16 bytes
3. Base64-encode the raw bytes
4. Apply base64url character substitutions: replace `+` with `-`, `/` with `_`
5. Strip trailing `=` padding

This always produces a **22-character** string.

### JavaScript

```js
function encodeRecipeId(uuid) {
  const hex = uuid.replace(/-/g, "")
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

// "3f2a1b4c-8e9d-4f2a-b1c3-7d6e5f4a3b2c" → "PyobTI6dTyqxw31uX0o7LA"
```

### Python

```python
import base64, uuid

def encode_recipe_id(recipe_uuid: str) -> str:
    return base64.urlsafe_b64encode(
        uuid.UUID(recipe_uuid).bytes
    ).rstrip(b"=").decode()

# "3f2a1b4c-8e9d-4f2a-b1c3-7d6e5f4a3b2c" → "PyobTI6dTyqxw31uX0o7LA"
```

### Swift

```swift
import Foundation

func encodeRecipeId(_ uuidString: String) -> String? {
    guard let uuid = UUID(uuidString: uuidString) else { return nil }
    let bytes = withUnsafeBytes(of: uuid.uuid) { Data($0) }
    return bytes.base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")
}
```

### Kotlin

```kotlin
import java.util.Base64
import java.util.UUID
import java.nio.ByteBuffer

fun encodeRecipeId(uuidString: String): String {
    val uuid = UUID.fromString(uuidString)
    val bytes = ByteBuffer.allocate(16).apply {
        putLong(uuid.mostSignificantBits)
        putLong(uuid.leastSignificantBits)
    }.array()
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
}
```

---

## Routing Behaviour

- The `id` segment is the **only** thing used to look up the recipe.
- The `slug` segment is **never validated** — any value (or none) resolves correctly.
- If the `slug` is missing or stale, the app issues a **301 redirect** to the canonical URL with the current slug. This means:
  - Old URLs remain permanently valid after a recipe is renamed
  - Linking with just the encoded ID (omitting the slug) also works and will redirect

---

## Decoding: base64url → UUID

To go back from the URL segment to the UUID (e.g. to call the Mealie API directly):

### JavaScript

```js
function decodeRecipeId(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const hex = Array.from(binary, c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}

// "PyobTI6dTyqxw31uX0o7LA" → "3f2a1b4c-8e9d-4f2a-b1c3-7d6e5f4a3b2c"
```

### Python

```python
import base64, uuid

def decode_recipe_id(encoded: str) -> str:
    return str(uuid.UUID(bytes=base64.urlsafe_b64decode(encoded + "==")))

# "PyobTI6dTyqxw31uX0o7LA" → "3f2a1b4c-8e9d-4f2a-b1c3-7d6e5f4a3b2c"
```
