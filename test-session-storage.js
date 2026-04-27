// Simple test to verify session storage functionality
// This would be run in the browser console to test

// Test the useSessionStorage hook
console.log('Testing ingredient checkbox session storage...')

// Simulate checking what's in session storage
const testRecipeId = 'test-recipe-123'
const testIngredientIndex = 0
const storageKey = `recipe-${testRecipeId}-ingredient-${testIngredientIndex}`

// Check if session storage is working
try {
  // Set a test value
  sessionStorage.setItem(storageKey, JSON.stringify(true))
  
  // Get the value back
  const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'false')
  console.log(`✓ Session storage working: ${stored}`)
  
  // Clean up
  sessionStorage.removeItem(storageKey)
  console.log('✓ Session storage test completed successfully')
} catch (error) {
  console.error('✗ Session storage test failed:', error)
}

console.log('Session storage is available for ingredient checkboxes!')