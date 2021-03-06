import { JSONSchema, Enum, JSONSchemaObject } from "@json-schema-tools/meta-schema";

import { CodeGen, TypeIntermediateRepresentation } from "./codegen";
import { getTitle } from "../utils";

export default class Typescript extends CodeGen {
  protected generate(s: JSONSchemaObject, ir: TypeIntermediateRepresentation) {
    return [
      ir.documentationComment,
      `export ${ir.prefix} ${this.getSafeTitle(s.title as string)}`,
      ir.prefix === "type" ? " = " : " ",
      ir.typing,
      ir.prefix === "type" ? ";" : "",
    ].join("");
  }

  protected handleBoolean(s: JSONSchemaObject): TypeIntermediateRepresentation {
    let typing = "boolean";
    if (s.const) {
      typing = s.const;
    }

    return { documentationComment: this.buildDocs(s), prefix: "type", typing };
  }

  protected handleNull(s: JSONSchemaObject): TypeIntermediateRepresentation {
    return { prefix: "type", typing: "null", documentationComment: this.buildDocs(s) };
  }

  protected handleNumber(s: JSONSchemaObject): TypeIntermediateRepresentation {
    let typing = "number";
    if (s.const) {
      typing = s.const;
    }

    return { documentationComment: this.buildDocs(s), prefix: "type", typing };
  }

  protected handleInteger(s: JSONSchemaObject): TypeIntermediateRepresentation {
    return this.handleNumber(s);
  }

  protected handleNumericalEnum(s: JSONSchemaObject): TypeIntermediateRepresentation {
    return {
      documentationComment: this.buildDocs(s),
      prefix: "type",
      typing: this.buildEnum(s),
    };
  }

  protected handleString(s: JSONSchemaObject): TypeIntermediateRepresentation {
    let typing = "string";
    if (s.const) {
      typing = `"${s.const}"`;
    }
    return { documentationComment: this.buildDocs(s), prefix: "type", typing };
  }

  protected handleStringEnum(s: JSONSchemaObject): TypeIntermediateRepresentation {
    return {
      documentationComment: this.buildDocs(s),
      prefix: "type",
      typing: this.buildEnum(s),
    };
  }

  protected handleOrderedArray(s: JSONSchemaObject): TypeIntermediateRepresentation {
    let typing = `[${this.getJoinedSafeTitles(s.items as JSONSchema[])}]`;
    if (s.const) {
      typing = s.const;
    }
    const prefix = "type";
    return { documentationComment: this.buildDocs(s), typing, prefix };
  }

  protected handleUnorderedArray(s: JSONSchemaObject): TypeIntermediateRepresentation {
    let typing = `${this.getSafeTitle(this.refToTitle(s.items as JSONSchema))}[]`;
    if (s.const) {
      typing = s.const;
    }
    const prefix = "type";
    return { documentationComment: this.buildDocs(s), prefix, typing };
  }

  protected handleUntypedArray(s: JSONSchemaObject): TypeIntermediateRepresentation {
    const typing = "any[]";
    const prefix = "type";
    return { documentationComment: this.buildDocs(s), prefix, typing };
  }

  protected handleObject(s: JSONSchemaObject): TypeIntermediateRepresentation {
    const ir = {
      documentationComment: this.buildDocs(s),
    } as TypeIntermediateRepresentation;

    if (s.const) {
      ir.typing = s.const;
      ir.prefix = "type";
      return ir;
    }

    const sProps = s.properties as { [k: string]: JSONSchema };
    const propertyTypings = Object.keys(sProps).reduce((typings: string[], key: string) => {
      const propSchema = sProps[key];
      let isRequired = false;
      if (s.required) {
        isRequired = s.required.indexOf(key) !== -1;
      }
      const title = this.getSafeTitle(this.refToTitle(propSchema));
      return [...typings, `  ${key}${isRequired ? "" : "?"}: ${title};`];
    }, []);

    if (s.patternProperties !== undefined) {
      const subTypes: string[] = [];
      Object.values(s.patternProperties).forEach((prop: JSONSchema) => {
        const title = this.getSafeTitle(this.refToTitle(prop));
        if (subTypes.includes(title) === false) {
          subTypes.push(title);
        }
      });
      propertyTypings.push(`  [regex: string]: ${subTypes.join(" | ")} | any;`);
    } else if (s.additionalProperties !== false) {
      propertyTypings.push("  [k: string]: any;");
    }

    ir.prefix = "interface";
    ir.typing = [`{`, ...propertyTypings, "}"].join("\n");

    return ir;
  }

  protected handleUntypedObject(s: JSONSchemaObject): TypeIntermediateRepresentation {
    return {
      prefix: "interface",
      typing: "{ [key: string]: any; }",
      documentationComment: this.buildDocs(s),
    };
  }

  protected handleAnyOf(s: JSONSchemaObject): TypeIntermediateRepresentation {
    const sAny = s.anyOf as JSONSchema[];
    return {
      documentationComment: this.buildDocs(s),
      prefix: "type",
      typing: this.getJoinedSafeTitles(sAny, " | "),
    };
  }

  protected handleAllOf(s: JSONSchemaObject): TypeIntermediateRepresentation {
    const sAll = s.allOf as JSONSchema[];
    return {
      documentationComment: this.buildDocs(s),
      prefix: "type",
      typing: this.getJoinedSafeTitles(sAll, " & "),
    };
  }

  protected handleOneOf(s: JSONSchemaObject): TypeIntermediateRepresentation {
    const sOne = s.oneOf as JSONSchema[];
    return {
      documentationComment: this.buildDocs(s),
      prefix: "type",
      typing: this.getJoinedSafeTitles(sOne, " | "),
    };
  }

  protected handleConstantBool(s: JSONSchema): TypeIntermediateRepresentation {
    return {
      typing: `type ${getTitle(s)} = any;`,
    };
  }

  protected handleUntyped(s: JSONSchemaObject): TypeIntermediateRepresentation {
    return { documentationComment: this.buildDocs(s), prefix: "type", typing: "any" };
  }

  private buildEnum(schema: JSONSchemaObject): string {
    const typeOf = schema.type === "string" ? "string" : "number";
    const sEnum = schema.enum as Enum;
    return sEnum
      .filter((s: any) => typeof s === typeOf)
      .map((s: string) => typeOf === "string" ? `"${s}"` : s)
      .join(" | ");
  }

  private buildDocs(s: JSONSchemaObject): string | undefined {
    const docStringLines = [];

    if (s.description) {
      docStringLines.push(` * ${s.description}`);
      docStringLines.push(" *");
    }

    if (s.default) {
      const def = s.default;
      let defAsStr = `${def}`;
      if (def instanceof Array || (typeof def === "object" && def !== null)) {
        defAsStr = JSON.stringify(def);
      }
      docStringLines.push(` * @default ${defAsStr}`);
      docStringLines.push(` *`);
    }

    if (s.examples) {
      s.examples.forEach((example: string) => {
        docStringLines.push(" * @example");
        docStringLines.push(` * \`${example}\``);
        docStringLines.push(" *");
      });
    }

    if (docStringLines.length > 0) {
      return [
        "/**",
        " *",
        ...docStringLines,
        " */",
        "",
      ].join("\n");
    }
  }
}
