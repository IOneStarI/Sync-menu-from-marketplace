# Package

### 🚀 List
> `GET /menu/:language/pack/list`

Params:
<!-- schema-block-begin:/services/menu/pack/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/pack/schema:params -->

Response: [Pack schema[]](#pack-schema)

### 🚀 Get one 
> `GET /menu/:language/pack/:_id`

Params:
<!-- schema-block-begin:/services/menu/pack/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/pack/schema:idparams -->

Response: [Pack schema](#pack-schema)

### 🚀 Create 
> `POST /menu/:language/pack`

Params:
<!-- schema-block-begin:/services/menu/pack/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/pack/schema:params -->

Payload: 

```json
In payload `category._id` is optional
```
<!-- schema-block-begin:/services/menu/pack/schema:payload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,100] | Name of section
posID | string,null | Internal ID in external POS system
price | number[≥0] | Current price
categories | array[nested schema] | **Pack category schema**

#### Pack category schema
 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
posID | string | Internal ID in external POS system
<!-- schema-block-end:/services/menu/pack/schema:payload -->

Response: [Pack schema](#pack-schema)

### 🚀 Update
> `PUT /menu/:language/pack/:_id`

Params:
<!-- schema-block-begin:/services/menu/pack/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/pack/schema:idparams -->

Payload:

```json
In payload `category._id` is optional
```

<!-- schema-block-begin:/services/menu/pack/schema:payload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,100] | Name of section
posID | string,null | Internal ID in external POS system
price | number[≥0] | Current price
categories | array[nested schema] | **Pack category schema**

#### Pack category schema
 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
posID | string | Internal ID in external POS system
<!-- schema-block-end:/services/menu/pack/schema:payload -->

Response: 204 HTTP code

### 🚀 Delete
> `DELETE /menu/:language/pack/:_id`

Params:
<!-- schema-block-begin:/services/menu/pack/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/pack/schema:idparams -->

Response: 204 HTTP code

### Pack schema

<!-- schema-block-begin:/services/menu/pack/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Name of section
posID | string,null | Internal ID in external POS system
price | number[≥0] | Current price
categories | array[nested schema] | **Pack category schema**

#### Pack category schema
 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
posID | string | Internal ID in external POS system
<!-- schema-block-end:/services/menu/pack/schema:schema -->

