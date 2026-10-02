from . import location, employee, product, inventory, sale, damage_report

from .location import (
    get_location,
    get_locations,
    create_location,
    update_location,
    delete_location,
)
from .employee import (
    get_employee,
    get_employee_by_employee_id,
    get_employees,
    create_employee,
    update_employee,
    delete_employee,
)
from .product import (
    get_product,
    get_products,
    create_product,
    update_product,
    delete_product,
)
from .inventory import (
    get_inventory,
    get_inventories,
    create_inventory,
    update_inventory,
    delete_inventory,
)
from .sale import (
    get_sale,
    get_sales,
    create_sale,
    update_sale,
    delete_sale,
)
from .damage_report import (
    get_damage_report,
    get_damage_reports,
    create_damage_report,
    update_damage_report,
    delete_damage_report,
    enrich_damage_report,
)

__all__ = [
    "location",
    "employee",
    "product",
    "inventory",
    "sale",
    "damage_report",
    "get_location",
    "get_locations",
    "create_location",
    "update_location",
    "delete_location",
    "get_employee",
    "get_employee_by_employee_id",
    "get_employees",
    "create_employee",
    "update_employee",
    "delete_employee",
    "get_product",
    "get_products",
    "create_product",
    "update_product",
    "delete_product",
    "get_inventory",
    "get_inventories",
    "create_inventory",
    "update_inventory",
    "delete_inventory",
    "get_sale",
    "get_sales",
    "create_sale",
    "update_sale",
    "delete_sale",
    "get_damage_report",
    "get_damage_reports",
    "create_damage_report",
    "update_damage_report",
    "delete_damage_report",
    "enrich_damage_report",
]
