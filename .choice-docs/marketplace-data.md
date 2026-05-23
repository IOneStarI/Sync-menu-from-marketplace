# (Beta) Dish Marketplace data sync

### 🚀 Get sync status

> `GET /menu/:lang/full/marketplace/data/status/:id`

:warning: Has rate limit 1 request / 5 seconds

#### Params:
<!-- schema-block-begin:/services/menu/full/marketplace-schema:getMarketplaceDataStatusParamsSchema -->

 Property | Type | Description
 --- | --- | --- | 
**language** * | string[2] | Current language (ex. en, de, cs)
**id** * | string | ID of the sync
<!-- schema-block-end:/services/menu/full/marketplace-schema:getMarketplaceDataStatusParamsSchema -->

#### Response:
<!-- schema-block-begin:/services/menu/full/marketplace-schema:getMarketplaceDataStatusResponseSchema -->

 Property | Type | Description
 --- | --- | --- | 
**done** * | boolean | Flag if the sync is done
progress | number | Progress in percent of the sync
<!-- schema-block-end:/services/menu/full/marketplace-schema:getMarketplaceDataStatusResponseSchema -->


### 🚀 Run sync 

> `POST /menu/:lang/full/marketplace/data`

:warning: Has rate limit 1 request / 5 seconds

#### Params:
<!-- schema-block-begin:/services/menu/full/marketplace-schema:getMarketplaceDataStatusParamsSchema -->

 Property | Type | Description
 --- | --- | --- | 
**language** * | string[2] | Current language (ex. en, de, cs)
**id** * | string | ID of the sync
<!-- schema-block-end:/services/menu/full/marketplace-schema:getMarketplaceDataStatusParamsSchema -->

#### Payload:
<!-- schema-block-begin:/services/menu/full/marketplace-schema:syncMarketplaceDataSchema -->

 Property | Type | Description
 --- | --- | --- | 
**dishes** * | array[nested schema] | **dishes schema**

#### dishes schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string[1,200] | Internal ID in external POS system
**data** * | nested schema object | Data for marketplace dish
<!-- schema-block-end:/services/menu/full/marketplace-schema:syncMarketplaceDataSchema -->

#### Data for marketplace dish 

*Key* - is marketplace place name available for restaurant (GLOVO, WOLT, BOLT, FOODORA, UBER, LOKO, JUSTEAT)

<!-- schema-block-begin:/services/menu/full/marketplace-schema:marketplaceDataDishPartnerSchema -->

 Property | Type | Description
 --- | --- | --- | 
name | string[0, 200] | Custom name of the dish in marketplace (if different from the original name)
price | number[≥0] | Custom price of the dish in marketplace (in cents, ex.: 1 USD = 100) (if different from the original price)
<!-- schema-block-end:/services/menu/full/marketplace-schema:marketplaceDataDishPartnerSchema -->

#### Response:
<!-- schema-block-begin:/services/menu/full/marketplace-schema:syncMarketplaceDataResponseSchema -->

 Property | Type | Description
 --- | --- | --- | 
**id** * | string | ID of the sync job
<!-- schema-block-end:/services/menu/full/marketplace-schema:syncMarketplaceDataResponseSchema -->


### Example:


#### Full import or first import

```json
{
    "dishes": [
        {
            "posID": "dish-1-posid-5",
            "data": {
                "WOLT": {
                    "price": 1000,
                    "name": "Wolt name POSID5"
                },
                "GLOVO": {
                    "price": 2500,
                    "name": "Glovo name POSID5"
                },
                "BOLT": {
                    "price": 3000,
                    "name": "Bolt name POSID5"
                }
            }
        },
        {
            "posID": "dish-1-posid3",
            "data": {
                "WOLT": {
                    "price": 1500,
                    "name": "Wolt name POSID3"
                },
                "GLOVO": {
                    "price": 2500,
                    "name": "Glovo name POSID3"
                },
                "BOLT": {
                    "price": 3500,
                    "name": "Bolt name POSID3"
                }
            }
        }
    ]
}
```
