export function zodToJsonSchema(zodSchema) {
    if (!zodSchema) return {};

    if (
        zodSchema._def.typeName === "ZodOptional"
        || zodSchema._def.typeName === "ZodDefault"
        || zodSchema._def.typeName === "ZodNullable"
    ) {
        return zodToJsonSchema(zodSchema._def.innerType);
    }
    if (zodSchema._def.typeName === "ZodEffects") {
        return zodToJsonSchema(zodSchema._def.schema);
    }

    const result = {};

    if (zodSchema.description) {
        result.description = zodSchema.description;
    }

    switch (zodSchema._def.typeName) {
        case "ZodString":
            result.type = "string";
            break;
        case "ZodNumber":
            result.type = "number";
            break;
        case "ZodBoolean":
            result.type = "boolean";
            break;
        case "ZodArray":
            result.type = "array";
            result.items = zodToJsonSchema(zodSchema._def.type);
            break;
        case "ZodObject":
            result.type = "object";
            result.properties = {};
            const required = [];
            const shape = zodSchema._def.shape();

            for (const key in shape) {
                const fieldSchema = shape[key];
                result.properties[key] = zodToJsonSchema(fieldSchema);
                const isOptional = fieldSchema._def.typeName === "ZodOptional";
                if (!isOptional) {
                    required.push(key);
                }
            }

            if (required.length > 0) {
                result.required = required;
            }
            break;
        case "ZodEnum":
            result.type = "string";
            result.enum = zodSchema._def.values;
            break;
        case "ZodRecord":
            result.type = "object";
            break;
        default:
            console.warn(`[zodToJsonSchema] Unsupported Zod type: ${zodSchema._def.typeName}`);
            break;
    }

    return result;
}
