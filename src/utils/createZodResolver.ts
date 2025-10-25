export function createZodResolver(schema) {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new Error('createZodResolver expects a Zod schema');
  }

  return async (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return {
        values: result.data,
        errors: {}
      };
    }

    const fieldErrors = {};

    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || issue.code;
      fieldErrors[path] = {
        type: issue.code,
        message: issue.message
      };
    }

    return {
      values: {},
      errors: fieldErrors
    };
  };
}
