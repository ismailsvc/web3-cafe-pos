#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub customer: Address,
    pub amount: i128,
    pub status: Symbol,
    pub items: Vec<Symbol>,
}

#[contract]
pub struct CafePos;

#[contractimpl]
impl CafePos {
    pub fn create_order(env: Env, customer: Address, token_address: Address, amount: i128, items: Vec<Symbol>) -> u32 {
        customer.require_auth();
        
        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();
        
        // Transfer funds from customer to the contract (Escrow)
        token_client.transfer(&customer, &contract_address, &amount);
        
        // Simple counter for order_id
        let mut order_id: u32 = env.storage().instance().get(&Symbol::new(&env, "order_seq")).unwrap_or(0);
        order_id += 1;
        env.storage().instance().set(&Symbol::new(&env, "order_seq"), &order_id);

        let order = Order {
            customer: customer.clone(),
            amount,
            status: Symbol::new(&env, "pending"),
            items,
        };

        // Store the order
        env.storage().persistent().set(&order_id, &order);
        
        order_id
    }

    pub fn fulfill_order(env: Env, waiter: Address, order_id: u32, token_address: Address, cafe_owner: Address) {
        waiter.require_auth(); // Verify waiter is authorized
        
        let mut order: Order = env.storage().persistent().get(&order_id).unwrap();
        if order.status != Symbol::new(&env, "pending") {
            panic!("Order is not pending");
        }
        
        // Update order status
        order.status = Symbol::new(&env, "fulfilled");
        env.storage().persistent().set(&order_id, &order);

        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();
        
        // Transfer the locked tokens from the contract to the cafe_owner
        token_client.transfer(&contract_address, &cafe_owner, &order.amount);
    }
    
    pub fn get_order(env: Env, order_id: u32) -> Order {
        env.storage().persistent().get(&order_id).unwrap()
    }
}
