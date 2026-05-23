import assert from 'node:assert/strict';
import test from 'node:test';
import { __test__ } from '../src/choice/client.js';

test('formats nested Choice validation errors for terminal output', () => {
  const message = __test__.formatApiError({
    message: 'Validation failed',
    errors: [
      {
        property: 'dishes[0].categoryPosID',
        message: 'category does not exist',
      },
      {
        property: 'sections[0].name',
        constraints: {
          isNotEmpty: 'name should not be empty',
        },
      },
    ],
  });

  assert.match(message, /Validation failed/);
  assert.match(message, /dishes\[0\]\.categoryPosID/);
  assert.match(message, /category does not exist/);
  assert.match(message, /name should not be empty/);
});
