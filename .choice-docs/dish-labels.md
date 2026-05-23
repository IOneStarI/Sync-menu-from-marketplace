# Personal Dish labels

### 🚀 List
> `GET /menu/:language/dish-labels/list`

Params:
<!-- schema-block-begin:/services/menu/dish-labels/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/dish-labels/schema:params -->

Response: [Dish label schema[]](#dish-label-schema)

### Dish label schema

<!-- schema-block-begin:/services/menu/dish-labels/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Dish label
<!-- schema-block-end:/services/menu/dish-labels/schema:schema -->

