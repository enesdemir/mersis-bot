
create table if not exists api_users
(
	id bigint auto_increment
		primary key,
	name varchar(255) null,
	private_key varchar(255) null
)
charset=utf8;

create table if not exists queues
(
	id bigint auto_increment
		primary key,
	created_at timestamp null,
	process_start_at timestamp null,
	process_end_at timestamp null,
	reference_number varchar(100) null,
	tax_number varchar(255) null,
	bot_payload mediumtext null,
	status tinyint default 0 null,
	error_log mediumtext null,
	user_payload mediumtext null,
	api_user_id bigint null,
	constraint queues_api_users_id_fk
		foreign key (api_user_id) references api_users (id)
);

create table if not exists failed_jobs
(
	id bigint auto_increment
		primary key,
	queue_id bigint null,
	description text null,
	constraint failed_jobs_queues_id_fk
		foreign key (queue_id) references queues (id)
)
charset=utf8;

