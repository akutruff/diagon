export type AnyFunc = (...args: any[]) => any;
export type AnyObject = Record<string, unknown>;
export type AnyArray = unknown[];

//export type PickNonFunctionProperties<T> = PickPropsNotOfType<T, AnyFunc>;

//export type PickPropsNotOfType<T, TPropTypes> = Pick<T, PropsNotOfType<T, TPropTypes>>;
//export type PickPropsOfType<T, TPropTypes> = Pick<T, PropsOfType<T, TPropTypes>>;

export type PropsOfType<T, TPropTypes> = {
    [K in keyof T]: T[K] extends TPropTypes ? K : never;
}[keyof T];

// export type PropsNotOfType<T, TPropTypes> = {
//     [K in keyof T]: T[K] extends TPropTypes ? never : K;
// }[keyof T];

export type PickNonFunctionProperties<T> = PickPropsNotOfType<T, AnyFunc>;

export type PickPropsNotOfType<T, TPropTypes> = Omit<T, PropsOfType<T, TPropTypes>>;
export type PickPropsOfType<T, TPropTypes> = Pick<T, PropsOfType<T, TPropTypes>>;

export interface HasPropertiesOfType<PropType> {
    [index: string]: PropType
}

export type MapPropertiesOfTypeToNewType<T, PropType, NewPropType> = T extends HasPropertiesOfType<PropType> ? {
    [P in keyof T]: NewPropType
} : never;

export type PickAndMapPropertiesOfTypeToNewType<T, PropType, NewPropType> = MapPropertiesOfTypeToNewType<PickPropsOfType<T, PropType>, PropType, NewPropType>;

//Make only certain properties optional.  It's like a selective partial.  
export type PickPartially<T, P extends keyof T> = Omit<T, P> & Partial<Pick<T, P>>;
export type PickReadonly<T, P extends keyof T> = Omit<T, P> & Readonly<Pick<T, P>>;

export type Primitives = number | string;

export type OptionalPropertyNames<T> = {
    [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T];

export type RequiredPropertyNames<T> = {
    [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T];

export type OptionalProperties<T> = Pick<T, OptionalPropertyNames<T>>;
export type RequiredProperties<T> = Pick<T, RequiredPropertyNames<T>>;

//https://github.com/microsoft/TypeScript/issues/27024#issuecomment-421529650
//https://stackoverflow.com/a/52473108/463084
export type IfEquals<X, Y, A, B> =
    (<T>() => T extends X ? 1 : 2) extends
    (<T>() => T extends Y ? 1 : 2) ? A : B;

export type WritablePropertyNames<T> = {
    [P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P, never>
}[keyof T];

export type ReadonlyPropertyNames<T> = {
    [P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { readonly [Q in P]: T[P] }, P, never>
}[keyof T];

export type ReadonlyProperties<T> = Pick<T, ReadonlyPropertyNames<T>>;
export type WritableProperties<T> = Pick<T, WritablePropertyNames<T>>;

//mad science: https://stackoverflow.com/questions/50639496/is-there-a-way-to-prevent-union-types-in-typescript 
export type NotAUnion<T, U = T> = U extends any ? [T] extends [boolean] ? T : [T] extends [U] ? T : never : never;

//ahejlsberg FTW: https://github.com/microsoft/TypeScript/issues/42644#issuecomment-774315112
export type Literal<T, LiteralValue> = LiteralValue extends T ? T extends LiteralValue ? never : LiteralValue : never;
export type StringLiteral<T> = Literal<string, T>;
export type NumberLiteral<T> = Literal<number, T>;

export type ElementType<T extends Array<unknown>> = T extends Array<infer TElement> ? TElement : never;
